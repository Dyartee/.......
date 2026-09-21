#include <iostream>
#include <string>
#include <atomic>
#include <csignal>
#include <chrono>
#include <thread>

#include "logger.h"
#include "protocol.h"
#include "websocket_server.h"
#include "json_helper.h"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

using namespace Dyarte::Agent;

static std::atomic<bool> g_keepRunning{true};
static WebSocketServer* g_serverInstance = nullptr;

#ifdef _WIN32
BOOL WINAPI ConsoleCtrlHandler(DWORD ctrlType) {
    switch (ctrlType) {
        case CTRL_C_EVENT:
        case CTRL_BREAK_EVENT:
        case CTRL_CLOSE_EVENT:
        case CTRL_LOGOFF_EVENT:
        case CTRL_SHUTDOWN_EVENT:
            Logger::Instance().Info("Received termination signal from Windows. Initiating graceful shutdown...");
            g_keepRunning.store(false);
            if (g_serverInstance) {
                g_serverInstance->Stop();
            }
            return TRUE;
        default:
            return FALSE;
    }
}
#else
void PosixSignalHandler(int signal) {
    Logger::Instance().Info("Received POSIX signal (" + std::to_string(signal) + "). Initiating graceful shutdown...");
    g_keepRunning.store(false);
    if (g_serverInstance) {
        g_serverInstance->Stop();
    }
}
#endif

void HandleIncomingClientMessage(SocketHandle clientSock, const std::string& rawMessage) {
    // 1. Validate payload size
    if (!SecurityValidator::ValidateMessageSize(rawMessage.size())) {
        Logger::Instance().Error("Message rejected: Size exceeded 64 KB limit.");
        std::string err = ResponseBuilder::BuildError("", "Payload size exceeded 64 KB limit.");
        g_serverInstance->SendTextMessage(clientSock, err);
        return;
    }

    // 2. Security validation against arbitrary execution / forbidden words
    if (SecurityValidator::ContainsForbiddenPatterns(rawMessage)) {
        Logger::Instance().Error("SECURITY ALERT: Forbidden execution pattern detected in client message. Rejected.");
        std::string err = ResponseBuilder::BuildError("", "Security validation failed: Forbidden command execution keyword detected.");
        g_serverInstance->SendTextMessage(clientSock, err);
        return;
    }

    // 3. JSON Syntax parsing
    JsonValue json;
    if (!JsonParser::Parse(rawMessage, json) || !json.is_object()) {
        Logger::Instance().Error("Invalid JSON payload received from client.");
        std::string err = ResponseBuilder::BuildError("", "Malformed JSON message.");
        g_serverInstance->SendTextMessage(clientSock, err);
        return;
    }

    // 4. Protocol Version Validation
    int protocolVer = json.get_field_int("protocol_version", 0);
    if (protocolVer != ProtocolConstants::PROTOCOL_VERSION) {
        Logger::Instance().Error("Protocol version mismatch. Expected: 1, Received: " + std::to_string(protocolVer));
        std::string err = ResponseBuilder::BuildError("", "Protocol version mismatch.");
        g_serverInstance->SendTextMessage(clientSock, err);
        return;
    }

    // 5. Message Type Routing
    std::string typeStr = json.get_field_string("type", "");
    std::string requestId = json.get_field_string("request_id", "");
    MessageType msgType = StringToMessageType(typeStr);

    switch (msgType) {
        case MessageType::HANDSHAKE: {
            std::string clientName = json.get_field_string("client", "UNKNOWN");
            Logger::Instance().Info("HANDSHAKE received from client: " + clientName);

            std::string response = ResponseBuilder::BuildHandshakeAck();
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Info("HANDSHAKE_ACK sent to client. Status: ONLINE");
            break;
        }

        case MessageType::PING: {
            int64_t timestamp = json.get_field_int64("timestamp", 0);
            Logger::Instance().Debug("PING received. Timestamp: " + std::to_string(timestamp));

            std::string response = ResponseBuilder::BuildPong(timestamp);
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Debug("PONG dispatched.");
            break;
        }

        case MessageType::TEST_CONNECTION: {
            Logger::Instance().Info("TEST_CONNECTION command received. Request ID: " + requestId);

            // Phase 1 Safe Test Command: Returns verified agent status without OS mutations
            std::string response = ResponseBuilder::BuildTestConnectionResult(requestId);
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Info("TEST_CONNECTION_RESULT dispatched. Success: true.");
            break;
        }

        case MessageType::APPLY_OPTIMIZATION: {
            std::string toolId = json.get_field_string("tool_id", "");
            Logger::Instance().Info("APPLY_OPTIMIZATION received for tool: " + toolId + " (Request ID: " + requestId + ")");

            if (toolId.empty()) {
                std::string response = ResponseBuilder::BuildError(requestId, "tool_id obrigatorio para aplicacao de otimizacao.", "INVALID_TOOL");
                g_serverInstance->SendTextMessage(clientSock, response);
                break;
            }

            // Explicit NOT_IMPLEMENTED response: Agent does not fake success when routine is not implemented
            std::string response = ResponseBuilder::BuildOptimizationResult(
                requestId,
                toolId,
                "NOT_IMPLEMENTED",
                false,
                "A rotina de otimizacao de baixo nivel (" + toolId + ") ainda nao foi implementada nesta versao do DYARTE Agent."
            );
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Warn("OPTIMIZATION_RESULT dispatched with status: NOT_IMPLEMENTED (tool_id: " + toolId + ")");
            break;
        }

        case MessageType::ROLLBACK_OPTIMIZATION: {
            std::string toolId = json.get_field_string("tool_id", "");
            Logger::Instance().Info("ROLLBACK_OPTIMIZATION received for tool: " + toolId + " (Request ID: " + requestId + ")");

            std::string response = ResponseBuilder::BuildOptimizationResult(
                requestId,
                toolId,
                "NOT_IMPLEMENTED",
                false,
                "Reversao nao disponivel: nenhuma operacao de baixo nivel foi aplicada anteriormente para " + toolId + "."
            );
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Warn("ROLLBACK_OPTIMIZATION dispatched with status: NOT_IMPLEMENTED");
            break;
        }

        case MessageType::EXECUTE_DRIVER_PACKAGE: {
            std::string vendor = json.get_field_string("vendor", "UNKNOWN");
            Logger::Instance().Info("EXECUTE_DRIVER_PACKAGE received for vendor: " + vendor + " (Request ID: " + requestId + ")");

            std::string response = ResponseBuilder::BuildDriverPackageResult(
                requestId,
                vendor,
                "NOT_IMPLEMENTED",
                false,
                "Execucao de driver via socket no Agent nao implementada. Utilize o DriverService nativo do Electron com Setup.exe verificado."
            );
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Warn("EXECUTE_DRIVER_PACKAGE rejected: Driver execution not implemented in Agent socket.");
            break;
        }

        case MessageType::GET_TELEMETRY: {
            Logger::Instance().Info("GET_TELEMETRY received (Request ID: " + requestId + ")");
            std::string response = ResponseBuilder::BuildError(
                requestId,
                "Telemetria continua de sensores em desenvolvimento no Agent.",
                "NOT_IMPLEMENTED"
            );
            g_serverInstance->SendTextMessage(clientSock, response);
            break;
        }

        default: {
            Logger::Instance().Warn("Rejected unknown or unauthorized message type: " + typeStr);
            std::string response = ResponseBuilder::BuildError(requestId, "Unknown or unauthorized message type: " + typeStr);
            g_serverInstance->SendTextMessage(clientSock, response);
            break;
        }
    }
}

int main(int argc, char* argv[]) {
    // Exact Console Output requirement:
    // DYARTE AGENT
    // Version: 1.0.0
    // Status: STARTING
    std::cout << "========================================" << std::endl;
    std::cout << "DYARTE AGENT" << std::endl;
    std::cout << "Version: 1.0.0" << std::endl;
    std::cout << "Status: STARTING" << std::endl;
    std::cout << "========================================" << std::endl;

    // Initialize local file logger
    Logger::Instance().Initialize("logs/dyarte-agent.log");
    Logger::Instance().Info("Initializing DYARTE AGENT v1.0.0...");

    // Register OS termination handler
#ifdef _WIN32
    if (!SetConsoleCtrlHandler(ConsoleCtrlHandler, TRUE)) {
        Logger::Instance().Warn("Could not register Windows ConsoleCtrlHandler.");
    } else {
        Logger::Instance().Info("Windows ConsoleCtrlHandler registered for safe shutdown.");
    }
#else
    std::signal(SIGINT, PosixSignalHandler);
    std::signal(SIGTERM, PosixSignalHandler);
#endif

    // Instantiate and start WebSocket server strictly on 127.0.0.1:49152
    WebSocketServer server(ProtocolConstants::DEFAULT_LISTEN_IP, ProtocolConstants::DEFAULT_PORT);
    g_serverInstance = &server;

    if (!server.Start(HandleIncomingClientMessage)) {
        Logger::Instance().Error("Fatal: Failed to start WebSocket server on 127.0.0.1:49152");
        std::cout << "Status: ERROR (Failed to bind 127.0.0.1:49152)" << std::endl;
        return 1;
    }

    // Status: ONLINE transition
    std::cout << "Status: ONLINE" << std::endl;
    std::cout << "Listening exclusively on 127.0.0.1:49152" << std::endl;
    std::cout << "Press Ctrl+C to stop the agent." << std::endl;
    std::cout << "========================================" << std::endl;
    Logger::Instance().Info("Agent Status transitioned to ONLINE. Ready for client connections.");

    // Main execution keep-alive loop
    while (g_keepRunning.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }

    Logger::Instance().Info("Shutting down DYARTE AGENT...");
    server.Stop();
    Logger::Instance().Info("DYARTE AGENT terminated safely.");
    Logger::Instance().Shutdown();

    std::cout << "DYARTE AGENT Status: STOPPED" << std::endl;
    return 0;
}
