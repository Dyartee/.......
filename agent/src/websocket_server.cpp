#include "websocket_server.h"
#include "logger.h"
#include "sha1_base64.h"
#include <iostream>
#include <sstream>
#include <cstring>
#include <algorithm>

namespace Dyarte {
namespace Agent {

static const char* WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

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

    while (request.find("\r\n\r\n") == std::string::npos) {
        int bytes = recv(clientSock, buffer, sizeof(buffer) - 1, 0);
        if (bytes <= 0) return false;
        buffer[bytes] = '\0';
        request.append(buffer, bytes);
        if (request.size() > 16384) return false; // Exceeded reasonable HTTP header size
    }

    // Extract Sec-WebSocket-Key
    std::string keyHeader = "Sec-WebSocket-Key: ";
    size_t keyPos = request.find(keyHeader);
    if (keyPos == std::string::npos) {
        keyHeader = "sec-websocket-key: ";
        keyPos = request.find(keyHeader);
    }
    if (keyPos == std::string::npos) return false;

    size_t keyStart = keyPos + keyHeader.size();
    size_t keyEnd = request.find("\r\n", keyStart);
    if (keyEnd == std::string::npos) return false;

    std::string secKey = request.substr(keyStart, keyEnd - keyStart);
    while (!secKey.empty() && (secKey.back() == ' ' || secKey.back() == '\r')) {
        secKey.pop_back();
    }

    // Compute Sec-WebSocket-Accept = Base64(SHA1(secKey + WS_GUID))
    std::string combined = secKey + WS_GUID;
    std::vector<uint8_t> shaHash = Sha1::Compute(combined);
    std::string acceptKey = Base64::Encode(shaHash.data(), shaHash.size());

    // Build HTTP 101 Response
    std::string response =
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";

    int sent = send(clientSock, response.c_str(), static_cast<int>(response.size()), 0);
    return sent == static_cast<int>(response.size());
}

bool WebSocketServer::ReadFrame(SocketHandle clientSock, std::string& outPayload, bool& outIsClose) {
    outPayload.clear();
    outIsClose = false;

    // Read first 2 bytes
    uint8_t header[2];
    int rec = recv(clientSock, reinterpret_cast<char*>(header), 2, 0);
    if (rec != 2) return false;

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
        send(clientSock, reinterpret_cast<const char*>(pongHeader), 2, 0);
        return true;
    }

    // Read Extended Length
    if (payloadLen == 126) {
        uint8_t extLen[2];
        if (recv(clientSock, reinterpret_cast<char*>(extLen), 2, 0) != 2) return false;
        payloadLen = (static_cast<uint64_t>(extLen[0]) << 8) | extLen[1];
    } else if (payloadLen == 127) {
        uint8_t extLen[8];
        if (recv(clientSock, reinterpret_cast<char*>(extLen), 8, 0) != 8) return false;
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
        if (recv(clientSock, reinterpret_cast<char*>(maskKey), 4, 0) != 4) return false;
    }

    // Read payload
    std::vector<char> buffer(static_cast<size_t>(payloadLen));
    size_t totalRead = 0;
    while (totalRead < payloadLen) {
        int bytes = recv(clientSock, buffer.data() + totalRead, static_cast<int>(payloadLen - totalRead), 0);
        if (bytes <= 0) return false;
        totalRead += bytes;
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

    int sent = send(clientSock, reinterpret_cast<const char*>(frame.data()), static_cast<int>(frame.size()), 0);
    return sent == static_cast<int>(frame.size());
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
