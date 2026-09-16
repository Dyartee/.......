#include "websocket_server.h"
#include "logger.h"
#include "sha1_base64.h"
#include <iostream>
#include <sstream>
#include <cstring>
#include <algorithm>
#include <unordered_map>
#include <cerrno>

namespace Dyarte {
namespace Agent {

static const char* WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

static std::string Trim(const std::string& str) {
    size_t start = 0;
    while (start < str.size() && (str[start] == ' ' || str[start] == '\t' || str[start] == '\r' || str[start] == '\n')) {
        start++;
    }
    size_t end = str.size();
    while (end > start && (str[end - 1] == ' ' || str[end - 1] == '\t' || str[end - 1] == '\r' || str[end - 1] == '\n')) {
        end--;
    }
    return str.substr(start, end - start);
}

static std::string ToLower(const std::string& str) {
    std::string res = str;
    std::transform(res.begin(), res.end(), res.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return res;
}

static bool SendExact(SocketHandle sock, const char* data, size_t len) {
    size_t total = 0;
    while (total < len) {
        int s = send(sock, data + total, static_cast<int>(len - total), 0);
        if (s <= 0) return false;
        total += s;
    }
    return true;
}

static bool RecvExact(SocketHandle sock, char* buf, size_t len) {
    size_t total = 0;
    while (total < len) {
        int r = recv(sock, buf + total, static_cast<int>(len - total), 0);
        if (r <= 0) return false;
        total += r;
    }
    return true;
}

WebSocketServer::WebSocketServer(const std::string& bindIp, int port)
    : bindIp_(bindIp), port_(port) {
}

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
    setsockopt(listenSocket_, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
    setsockopt(listenSocket_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
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

    Logger::Instance().Info("WebSocket server stopped cleanly.");
}

size_t WebSocketServer::GetConnectedClientsCount() {
    std::lock_guard<std::mutex> lock(clientsMutex_);
    return connectedClients_.size();
}

void WebSocketServer::RunServerLoop() {
    while (isRunning_.load()) {
        fd_set readFds;
        FD_ZERO(&readFds);
        FD_SET(listenSocket_, &readFds);

        timeval timeout{};
        timeout.tv_sec = 0;
        timeout.tv_usec = 200000; // 200ms timeout for non-blocking interruptibility

        int activity = select(static_cast<int>(listenSocket_ + 1), &readFds, nullptr, nullptr, &timeout);
        if (activity < 0) {
            if (!isRunning_.load()) break;
            continue;
        }

        if (activity > 0 && FD_ISSET(listenSocket_, &readFds)) {
            sockaddr_in clientAddr{};
#ifdef _WIN32
            int clientLen = sizeof(clientAddr);
#else
            socklen_t clientLen = sizeof(clientAddr);
#endif
            SocketHandle clientSock = accept(listenSocket_, (struct sockaddr*)&clientAddr, &clientLen);
            if (clientSock == INVALID_SOCK_HANDLE) {
                continue;
            }

            char clientIpStr[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &(clientAddr.sin_addr), clientIpStr, INET_ADDRSTRLEN);

            // Double security verification: Reject connection if not loopback
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

    // Read until double CRLF (\r\n\r\n) or double LF (\n\n) per HTTP specs
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

        Logger::Instance().Info("[WS DEBUG] Waiting HTTP handshake...");
        int bytes = recv(clientSock, buffer, sizeof(buffer) - 1, 0);

        if (bytes == 0) {
            Logger::Instance().Warn("[WS DEBUG] recv returned: 0 (client closed connection normally / sent FIN before sending HTTP headers)");
            Logger::Instance().Warn("WebSocket handshake failed: Connection closed or read error while awaiting HTTP headers.");
            return false;
        } else if (bytes < 0) {
#ifdef _WIN32
            int err = WSAGetLastError();
#else
            int err = errno;
#endif
            Logger::Instance().Warn("[WS DEBUG] recv returned: " + std::to_string(bytes) + " (socket error, code: " + std::to_string(err) + ")");
            Logger::Instance().Warn("WebSocket handshake failed: Connection closed or read error while awaiting HTTP headers.");
            return false;
        } else {
            buffer[bytes] = '\0';
            std::string prefix;
            // Extract only up to first line or 60 chars (no cookies, tokens, or sensitive data)
            for (int i = 0; i < bytes && i < 60; ++i) {
                if (buffer[i] == '\r' || buffer[i] == '\n') break;
                prefix += buffer[i];
            }
            Logger::Instance().Info("[WS DEBUG] recv returned: " + std::to_string(bytes));
            Logger::Instance().Info("[WS DEBUG] Request prefix: " + prefix);
            request.append(buffer, bytes);
        }

        if (request.size() > 16384) {
            Logger::Instance().Warn("WebSocket handshake rejected: HTTP headers size exceeded 16 KB.");
            std::string resp = "HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n";
            SendExact(clientSock, resp.c_str(), resp.size());
            return false;
        }
    }

    // Parse HTTP lines
    std::istringstream stream(request.substr(0, headerEnd));
    std::string requestLine;
    if (!std::getline(stream, requestLine)) {
        Logger::Instance().Warn("WebSocket handshake rejected: Empty request line.");
        return false;
    }

    // Validate Request-Line: RFC 6455 requires GET method and at least HTTP/1.1
    requestLine = Trim(requestLine);
    std::istringstream reqLineStream(requestLine);
    std::string method, uri, httpVer;
    reqLineStream >> method >> uri >> httpVer;

    if (method != "GET") {
        Logger::Instance().Warn("WebSocket handshake rejected: RFC 6455 requires GET method, received: " + method);
        std::string resp = "HTTP/1.1 405 Method Not Allowed\r\nAllow: GET\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    if (httpVer.rfind("HTTP/1.", 0) != 0 && httpVer != "HTTP/2.0") {
        Logger::Instance().Warn("WebSocket handshake rejected: Invalid HTTP version: " + httpVer);
        std::string resp = "HTTP/1.1 505 HTTP Version Not Supported\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // Parse Headers (Case-Insensitive map, robust to header ordering and spacing)
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

    // 1. Validate 'Upgrade: websocket'
    auto itUpgrade = headers.find("upgrade");
    if (itUpgrade == headers.end() || ToLower(itUpgrade->second).find("websocket") == std::string::npos) {
        Logger::Instance().Warn("WebSocket handshake rejected: Missing or invalid Upgrade header (expected 'websocket').");
        std::string resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // 2. Validate 'Connection: Upgrade'
    auto itConn = headers.find("connection");
    if (itConn == headers.end() || ToLower(itConn->second).find("upgrade") == std::string::npos) {
        Logger::Instance().Warn("WebSocket handshake rejected: Missing or invalid Connection header (must include 'Upgrade').");
        std::string resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // 3. Validate 'Sec-WebSocket-Version: 13'
    auto itVer = headers.find("sec-websocket-version");
    if (itVer == headers.end() || itVer->second != "13") {
        std::string ver = (itVer != headers.end()) ? itVer->second : "none";
        Logger::Instance().Warn("WebSocket handshake rejected: Unsupported Sec-WebSocket-Version (" + ver + "), expected 13.");
        std::string resp = "HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    // 4. Validate 'Sec-WebSocket-Key'
    auto itKey = headers.find("sec-websocket-key");
    if (itKey == headers.end() || itKey->second.empty()) {
        Logger::Instance().Warn("WebSocket handshake rejected: Missing or empty Sec-WebSocket-Key.");
        std::string resp = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        SendExact(clientSock, resp.c_str(), resp.size());
        return false;
    }

    std::string secKey = itKey->second;

    // 5. Compute Sec-WebSocket-Accept = Base64(SHA1(secKey + WS_GUID))
    std::string combined = secKey + WS_GUID;
    std::vector<uint8_t> shaHash = Sha1::Compute(combined);
    std::string acceptKey = Base64::Encode(shaHash.data(), shaHash.size());

    // 6. Build HTTP 101 Response per RFC 6455
    std::string response =
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";

    if (!SendExact(clientSock, response.c_str(), response.size())) {
        Logger::Instance().Error("WebSocket handshake failed: Could not send HTTP 101 Switching Protocols response.");
        return false;
    }

    Logger::Instance().Info("WebSocket handshake HTTP 101 Switching Protocols sent successfully.");
    return true;
}

bool WebSocketServer::ReadFrame(SocketHandle clientSock, std::string& outPayload, bool& outIsClose) {
    outPayload.clear();
    outIsClose = false;

    // Read first 2 bytes safely
    uint8_t header[2];
    if (!RecvExact(clientSock, reinterpret_cast<char*>(header), 2)) {
        return false;
    }

    uint8_t opcode = header[0] & 0x0F;
    bool isMasked = (header[1] & 0x80) != 0;
    uint64_t payloadLen = header[1] & 0x7F;

    // Handle Connection Close Opcode (0x8)
    if (opcode == 0x8) {
        outIsClose = true;
        return true;
    }

    // Handle Ping Opcode (0x9) -> respond with Pong (0xA)
    if (opcode == 0x9) {
        uint8_t pongHeader[2] = { 0x8A, 0x00 };
        SendExact(clientSock, reinterpret_cast<const char*>(pongHeader), 2);
        return true;
    }

    // Handle Pong Opcode (0xA) -> keepalive acknowledged
    if (opcode == 0xA) {
        return true;
    }

    // Read Extended Length
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

    // Max message limit check (64 KB)
    if (payloadLen > 65536) {
        Logger::Instance().Error("WebSocket frame payload exceeds max size limit (64 KB).");
        return false;
    }

    // Mask key (RFC 6455 requires client-to-server frames to be masked)
    uint8_t maskKey[4] = { 0, 0, 0, 0 };
    if (isMasked) {
        if (!RecvExact(clientSock, reinterpret_cast<char*>(maskKey), 4)) return false;
    }

    // Read payload
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

    outPayload.assign(buffer.data(), buffer.size());
    return true;
}

bool WebSocketServer::SendTextMessage(SocketHandle clientSock, const std::string& text) {
    std::vector<uint8_t> frame;
    frame.reserve(10 + text.size());

    // Byte 0: FIN (0x80) | Text Opcode (0x01) = 0x81
    frame.push_back(0x81);

    // Byte 1+: Payload Length (Server-to-client frames are unmasked per RFC 6455)
    size_t len = text.size();
    if (len <= 125) {
        frame.push_back(static_cast<uint8_t>(len));
    } else if (len <= 65535) {
        frame.push_back(126);
        frame.push_back(static_cast<uint8_t>((len >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>(len & 0xFF));
    } else {
        frame.push_back(127);
        for (int i = 7; i >= 0; i--) {
            frame.push_back(static_cast<uint8_t>((len >> (i * 8)) & 0xFF));
        }
    }

    // Payload data
    frame.insert(frame.end(), text.begin(), text.end());

    return SendExact(clientSock, reinterpret_cast<const char*>(frame.data()), frame.size());
}

void WebSocketServer::CloseClient(SocketHandle clientSock) {
    {
        std::lock_guard<std::mutex> lock(clientsMutex_);
        auto it = std::find(connectedClients_.begin(), connectedClients_.end(), clientSock);
        if (it != connectedClients_.end()) {
            connectedClients_.erase(it);
        }
    }
    closesocket(clientSock);
    Logger::Instance().Info("Client socket closed and unregistered.");
}

} // namespace Agent
} // namespace Dyarte
