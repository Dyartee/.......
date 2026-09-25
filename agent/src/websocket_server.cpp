#include "websocket_server.h"
#include "logger.h"
#include "sha1_base64.h"

#include <iostream>
#include <sstream>
#include <unordered_map>
#include <algorithm>
#include <cstring>

namespace Dyarte {
namespace Agent {

namespace {
    const std::string WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    std::string ToLower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) {
            return static_cast<char>(std::tolower(c));
        });
        return s;
    }

    std::string Trim(const std::string& s) {
        auto wsfront = std::find_if_not(s.begin(), s.end(), [](int c) { return std::isspace(c); });
        auto wsback = std::find_if_not(s.rbegin(), s.rend(), [](int c) { return std::isspace(c); }).base();
        return (wsback <= wsfront ? std::string() : std::string(wsfront, wsback));
    }

    bool SendExact(SocketHandle sock, const char* buffer, size_t length) {
        size_t totalSent = 0;
        while (totalSent < length) {
            int sent = send(sock, buffer + totalSent, static_cast<int>(length - totalSent), 0);
            if (sent <= 0) return false;
            totalSent += sent;
        }
        return true;
    }

    bool RecvExact(SocketHandle sock, char* buffer, size_t length) {
        size_t totalReceived = 0;
        while (totalReceived < length) {
            int recvd = recv(sock, buffer + totalReceived, static_cast<int>(length - totalReceived), 0);
            if (recvd <= 0) return false;
            totalReceived += recvd;
        }
        return true;
    }
}

WebSocketServer::WebSocketServer(const std::string& bindIp, int port)
    : bindIp_(bindIp), port_(port) {}

WebSocketServer::~WebSocketServer() {
    Stop();
}

bool WebSocketServer::Start(MessageCallback onMessage) {
    if (isRunning_.load()) return true;

    onMessage_ = onMessage;

#ifdef _WIN32
    WSADATA wsaData;
    int wsaRes = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (wsaRes != 0) {
        Logger::Instance().Error("WSAStartup failed with code: " + std::to_string(wsaRes));
        return false;
    }
#endif

    listenSocket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listenSocket_ == INVALID_SOCK_HANDLE) {
        Logger::Instance().Error("Failed to create TCP socket.");
        return false;
    }

    int opt = 1;
#ifdef _WIN32
    // Item 12: SO_EXCLUSIVEADDRUSE prevents local port hijacking on Windows
    setsockopt(listenSocket_, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char*)&opt, sizeof(opt));
#else
    setsockopt(listenSocket_, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#endif

    sockaddr_in serverAddr{};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(static_cast<uint16_t>(port_));

    // STRICT BIND: Bind exclusively to 127.0.0.1 (Loopback only)
    if (inet_pton(AF_INET, bindIp_.c_str(), &serverAddr.sin_addr) <= 0) {
        Logger::Instance().Error("Invalid IP address for loopback binding: " + bindIp_);
        closesocket(listenSocket_);
        listenSocket_ = INVALID_SOCK_HANDLE;
        return false;
    }

    if (bind(listenSocket_, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCK_ERROR_CODE) {
        Logger::Instance().Error("Failed to bind socket to " + bindIp_ + ":" + std::to_string(port_));
        closesocket(listenSocket_);
        listenSocket_ = INVALID_SOCK_HANDLE;
        return false;
    }

    if (listen(listenSocket_, SOMAXCONN) == SOCK_ERROR_CODE) {
        Logger::Instance().Error("Failed to listen on socket.");
        closesocket(listenSocket_);
        listenSocket_ = INVALID_SOCK_HANDLE;
        return false;
    }

    isRunning_.store(true);
    Logger::Instance().Info("WebSocket server successfully bound strictly to " + bindIp_ + ":" + std::to_string(port_));

    serverThread_ = std::thread(&WebSocketServer::RunServerLoop, this);
    return true;
}

void WebSocketServer::Stop() {
    if (!isRunning_.exchange(false)) {
        return;
    }

    Logger::Instance().Info("Stopping WebSocket server...");

    if (listenSocket_ != INVALID_SOCK_HANDLE) {
        closesocket(listenSocket_);
        listenSocket_ = INVALID_SOCK_HANDLE;
    }

    // Item 15: Concurrency safety on client disconnection
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        for (SocketHandle sock : connectedClients_) {
            closesocket(sock);
        }
        connectedClients_.clear();
    }

    if (serverThread_.joinable()) {
        serverThread_.join();
    }

#ifdef _WIN32
    WSACleanup();
#endif
    Logger::Instance().Info("WebSocket server stopped successfully.");
}

size_t WebSocketServer::GetConnectedClientsCount() {
    std::lock_guard<std::mutex> lock(clientsMutex_);
    return connectedClients_.size();
}

void WebSocketServer::RunServerLoop() {
    while (isRunning_.load()) {
        sockaddr_in clientAddr{};
        socklen_t clientLen = sizeof(clientAddr);

        SocketHandle clientSock = accept(listenSocket_, (struct sockaddr*)&clientAddr, &clientLen);
        if (clientSock == INVALID_SOCK_HANDLE) {
            if (!isRunning_.load()) break;
            continue;
        }

        // Item 11: Configure SO_RCVTIMEO (30 seconds) to prevent hanging threads
#ifdef _WIN32
        DWORD timeoutMs = 30000;
        setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeoutMs, sizeof(timeoutMs));
#else
        struct timeval tv;
        tv.tv_sec = 30;
        tv.tv_usec = 0;
        setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
#endif

        char clientIpStr[INET_ADDRSTRLEN] = {0};
        inet_ntop(AF_INET, &clientAddr.sin_addr, clientIpStr, sizeof(clientIpStr));

        // Strict loopback check
        if (std::string(clientIpStr) != "127.0.0.1") {
            Logger::Instance().Warn("Rejected non-loopback connection attempt from: " + std::string(clientIpStr));
            closesocket(clientSock);
            continue;
        }

        Logger::Instance().Info("Client connected from: " + std::string(clientIpStr));

        std::thread([this, clientSock]() {
            this->HandleClient(clientSock);
        }).detach();
    }
}

void WebSocketServer::HandleClient(SocketHandle clientSock) {
    if (!PerformHandshake(clientSock)) {
        Logger::Instance().Warn("WebSocket handshake failed. Closing client socket.");
        closesocket(clientSock);
        return;
    }

    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        connectedClients_.push_back(clientSock);
    }

    Logger::Instance().Info("WebSocket handshake complete. Client registered.");

    while (isRunning_.load()) {
        std::string payload;
        bool isClose = false;

        if (!ReadFrame(clientSock, payload, isClose)) {
            break;
        }

        if (isClose) {
            Logger::Instance().Info("Client requested connection close frame.");
            break;
        }

        if (!payload.empty() && onMessage_) {
            onMessage_(clientSock, payload);
        }
    }

    CloseClient(clientSock);
}

bool WebSocketServer::PerformHandshake(SocketHandle clientSock) {
    std::string request;
    char buffer[4096];
    size_t headerEnd = std::string::npos;

    while (true) {
        size_t crlfPos = request.find("\r\n\r\n");
        if (crlfPos != std::string::npos) {
            headerEnd = crlfPos;
            break;
        }
        size_t lfPos = request.find("\n\n");
        if (lfPos != std::string::npos) {
            headerEnd = lfPos;
            break;
        }

        int bytes = recv(clientSock, buffer, sizeof(buffer) - 1, 0);
        if (bytes <= 0) {
            Logger::Instance().Warn("WebSocket handshake failed: Connection closed while awaiting HTTP headers.");
            return false;
        }

        buffer[bytes] = '\0';
        request.append(buffer, bytes);

        if (request.size() > 16384) {
            Logger::Instance().Warn("WebSocket handshake rejected: HTTP headers exceeded 16 KB.");
            std::string resp = "HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n";
            SendExact(clientSock, resp.c_str(), resp.size());
            return false;
        }
    }

    std::istringstream stream(request.substr(0, headerEnd));
    std::string requestLine;
    if (!std::getline(stream, requestLine)) {
        return false;
    }

    requestLine = Trim(requestLine);
    std::istringstream reqLineStream(requestLine);
    std::string method, uri, httpVer;
    reqLineStream >> method >> uri >> httpVer;

    if (method != "GET") {
        std::string resp = "HTTP/1.1 405 Method Not Allowed\r\nAllow: GET\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    std::unordered_map<std::string, std::string> headers;
    std::string headerLine;
    while (std::getline(stream, headerLine)) {
        headerLine = Trim(headerLine);
        if (headerLine.empty()) continue;

        size_t colonPos = headerLine.find(':');
        if (colonPos == std::string::npos) continue;

        std::string headerName = ToLower(Trim(headerLine.substr(0, colonPos)));
        std::string headerVal = Trim(headerLine.substr(colonPos + 1));

        if (headers.find(headerName) != headers.end()) {
            headers[headerName] += ", " + headerVal;
        } else {
            headers[headerName] = headerVal;
        }
    }

    // Item 8: Validate Origin header against authorized app origins
    auto itOrigin = headers.find("origin");
    if (itOrigin != headers.end() && !itOrigin->second.empty()) {
        std::string origin = ToLower(itOrigin->second);
        bool originAllowed = (
            origin == "file://" ||
            origin.rfind("file://", 0) == 0 ||
            origin.rfind("app://", 0) == 0 ||
            origin == "null" ||
            origin.find("127.0.0.1") != std::string::npos ||
            origin.find("localhost") != std::string::npos
        );
        if (!originAllowed) {
            Logger::Instance().Warn("WebSocket handshake REJECTED: Origin forbidden: " + origin);
            std::string resp = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n";
            SendExact(clientSock, resp.c_str(), resp.size());
            return false;
        }
    }

    // Validate Host header
    auto itHost = headers.find("host");
    if (itHost != headers.end()) {
        std::string host = ToLower(itHost->second);
        if (host.find("127.0.0.1") == std::string::npos && host.find("localhost") == std::string::npos) {
            Logger::Instance().Warn("WebSocket handshake REJECTED: Host forbidden: " + host);
            std::string resp = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n";
            SendExact(clientSock, resp.c_str(), resp.size());
            return false;
        }
    }

    // 1. Upgrade: websocket
    auto itUpgrade = headers.find("upgrade");
    if (itUpgrade == headers.end() || ToLower(itUpgrade->second).find("websocket") == std::string::npos) {
        std::string resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // 2. Connection: Upgrade
    auto itConn = headers.find("connection");
    if (itConn == headers.end() || ToLower(itConn->second).find("upgrade") == std::string::npos) {
        std::string resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // 3. Sec-WebSocket-Version: 13
    auto itVer = headers.find("sec-websocket-version");
    if (itVer == headers.end() || itVer->second != "13") {
        std::string resp = "HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // 4. Sec-WebSocket-Key
    auto itKey = headers.find("sec-websocket-key");
    if (itKey == headers.end() || itKey->second.empty()) {
        std::string resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    std::string secKey = itKey->second;
    std::string combined = secKey + WS_GUID;
    std::vector<uint8_t> shaHash = Sha1::Compute(combined);
    std::string acceptKey = Base64::Encode(shaHash.data(), shaHash.size());

    std::string response =
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";

    if (!SendExact(clientSock, response.c_str(), response.size())) {
        return false;
    }

    Logger::Instance().Info("WebSocket handshake HTTP 101 Switching Protocols sent successfully.");
    return true;
}

// Item 10: ReadFrame consumes mask and payload for PING (0x9) and PONG (0xA)
bool WebSocketServer::ReadFrame(SocketHandle clientSock, std::string& outPayload, bool& outIsClose) {
    outPayload.clear();
    outIsClose = false;

    while (isRunning_.load()) {
        uint8_t header[2];
        if (!RecvExact(clientSock, reinterpret_cast<char*>(header), 2)) {
            return false;
        }

        uint8_t opcode = header[0] & 0x0F;
        bool isMasked = (header[1] & 0x80) != 0;
        uint64_t payloadLen = header[1] & 0x7F;

        if (opcode == 0x8) {
            outIsClose = true;
            return true;
        }

        // Extended Length
        if (payloadLen == 126) {
            uint8_t extLen[2];
            if (!RecvExact(clientSock, reinterpret_cast<char*>(extLen), 2)) return false;
            payloadLen = (static_cast<uint64_t>(extLen[0]) << 8) | extLen[1];
        } else if (payloadLen == 127) {
            uint8_t extLen[8];
            if (!RecvExact(clientSock, reinterpret_cast<char*>(extLen), 8)) return false;
            payloadLen = 0;
            for (int i = 0; i < 8; i++) {
                payloadLen = (payloadLen << 8) | extLen[i];
            }
        }

        if (payloadLen > 65536) {
            Logger::Instance().Error("WebSocket frame payload exceeds limit (64 KB).");
            return false;
        }

        // Mask key
        uint8_t maskKey[4] = { 0, 0, 0, 0 };
        if (isMasked) {
            if (!RecvExact(clientSock, reinterpret_cast<char*>(maskKey), 4)) return false;
        }

        // Read payload bytes completely
        std::vector<char> buffer(static_cast<size_t>(payloadLen));
        if (payloadLen > 0) {
            if (!RecvExact(clientSock, buffer.data(), static_cast<size_t>(payloadLen))) {
                return false;
            }
        }

        // Unmask
        if (isMasked) {
            for (size_t i = 0; i < payloadLen; i++) {
                buffer[i] ^= maskKey[i % 4];
            }
        }

        // If Ping (0x9), respond with Pong (0xA) using the exact same unmasked payload
        if (opcode == 0x9) {
            std::vector<uint8_t> pongFrame;
            pongFrame.push_back(0x8A);
            if (payloadLen < 126) {
                pongFrame.push_back(static_cast<uint8_t>(payloadLen));
            } else {
                pongFrame.push_back(126);
                pongFrame.push_back(static_cast<uint8_t>((payloadLen >> 8) & 0xFF));
                pongFrame.push_back(static_cast<uint8_t>(payloadLen & 0xFF));
            }
            pongFrame.insert(pongFrame.end(), buffer.begin(), buffer.end());
            SendExact(clientSock, reinterpret_cast<const char*>(pongFrame.data()), pongFrame.size());
            continue; // read next application frame
        }

        // If Pong (0xA), payload has been consumed, loop to read next frame
        if (opcode == 0xA) {
            continue;
        }

        outPayload.assign(buffer.data(), buffer.size());
        return true;
    }

    return false;
}

bool WebSocketServer::SendTextMessage(SocketHandle clientSock, const std::string& text) {
    std::vector<uint8_t> frame;
    frame.push_back(0x81); // FIN = 1, Opcode = 1 (Text)

    size_t len = text.size();
    if (len < 126) {
        frame.push_back(static_cast<uint8_t>(len));
    } else if (len <= 0xFFFF) {
        frame.push_back(126);
        frame.push_back(static_cast<uint8_t>((len >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>(len & 0xFF));
    } else {
        frame.push_back(127);
        for (int i = 7; i >= 0; i--) {
            frame.push_back(static_cast<uint8_t>((len >> (i * 8)) & 0xFF));
        }
    }

    frame.insert(frame.end(), text.begin(), text.end());
    return SendExact(clientSock, reinterpret_cast<const char*>(frame.data()), frame.size());
}

// Item 15: Concurrency-guarded close to prevent double-closing or race conditions
void WebSocketServer::CloseClient(SocketHandle clientSock) {
    bool found = false;
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        auto it = std::find(connectedClients_.begin(), connectedClients_.end(), clientSock);
        if (it != connectedClients_.end()) {
            connectedClients_.erase(it);
            found = true;
        }
    }

    if (found) {
        closesocket(clientSock);
        Logger::Instance().Info("Client socket closed and unregistered cleanly.");
    }
}

} // namespace Agent
} // namespace Dyarte
