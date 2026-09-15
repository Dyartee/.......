#pragma once

#include <string>
#include <functional>
#include <atomic>
#include <thread>
#include <vector>
#include <mutex>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
typedef SOCKET SocketHandle;
#define INVALID_SOCK_HANDLE INVALID_SOCKET
#define SOCK_ERROR_CODE SOCKET_ERROR
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
typedef int SocketHandle;
#define INVALID_SOCK_HANDLE (-1)
#define SOCK_ERROR_CODE (-1)
#define closesocket close
#endif

namespace Dyarte {
namespace Agent {

using MessageCallback = std::function<void(SocketHandle clientSock, const std::string& message)>;

class WebSocketServer {
public:
    WebSocketServer(const std::string& bindIp, int port);
    ~WebSocketServer();

    bool Start(MessageCallback onMessage);
    void Stop();
    bool SendTextMessage(SocketHandle clientSock, const std::string& text);

    bool IsRunning() const { return isRunning_.load(); }
    size_t GetConnectedClientsCount();

private:
    std::string bindIp_;
    int port_;
    std::atomic<bool> isRunning_{false};
    SocketHandle listenSocket_{INVALID_SOCK_HANDLE};
    std::thread serverThread_;

    std::mutex clientsMutex_;
    std::vector<SocketHandle> connectedClients_;

    MessageCallback onMessage_;

    void RunServerLoop();
    void HandleClient(SocketHandle clientSock);
    bool PerformHandshake(SocketHandle clientSock);
    bool ReadFrame(SocketHandle clientSock, std::string& outPayload, bool& outIsClose);
    void CloseClient(SocketHandle clientSock);
};

} // namespace Agent
} // namespace Dyarte
