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

struct PowerSchemeInfo {
    std::string guid;
    std::string name;
    bool valid = false;
};

static std::string g_previousPowerSchemeGuid = "";
static std::string g_previousPowerSchemeName = "";

static PowerSchemeInfo GetActivePowerScheme() {
    PowerSchemeInfo info;
#ifdef _WIN32
    FILE* pipe = _popen("powercfg /getactivescheme", "r");
    if (!pipe) return info;
    char buffer[256];
    std::string result = "";
    while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
        result += buffer;
    }
    _pclose(pipe);

    size_t guidPos = result.find("GUID: ");
    if (guidPos != std::string::npos) {
        std::string sub = result.substr(guidPos + 6);
        size_t spacePos = sub.find_first_of(" \t\r\n");
        if (spacePos != std::string::npos) {
            info.guid = sub.substr(0, spacePos);
        }
    }
    size_t parenStart = result.find("(");
    size_t parenEnd = result.rfind(")");
    if (parenStart != std::string::npos && parenEnd != std::string::npos && parenEnd > parenStart) {
        info.name = result.substr(parenStart + 1, parenEnd - parenStart - 1);
    }
    info.valid = !info.guid.empty();
#endif
    return info;
}

static bool SetActivePowerScheme(const std::string& guid) {
#ifdef _WIN32
    for (char c : guid) {
        if (!std::isalnum(c) && c != '-') return false;
    }
    std::string cmd = "powercfg /setactive " + guid;
    int res = system(cmd.c_str());
    return res == 0;
#else
    (void)guid;
    return false;
#endif
}

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

        case MessageType::GET_STATUS: {
            Logger::Instance().Info("GET_STATUS command received. Request ID: " + requestId);
#ifdef _WIN32
            PowerSchemeInfo curScheme = GetActivePowerScheme();
            std::string ramTotalStr = "";
            MEMORYSTATUSEX memInfo;
            memInfo.dwLength = sizeof(MEMORYSTATUSEX);
            if (GlobalMemoryStatusEx(&memInfo)) {
                int64_t totalGb = static_cast<int64_t>((memInfo.ullTotalPhys / (1024 * 1024 * 1024)) + 0.5);
                ramTotalStr = std::to_string(totalGb) + " GB";
            }

            std::string response = ResponseBuilder::BuildStatusResult(
                requestId,
                "Windows",
                true,
                curScheme.guid,
                curScheme.name,
                "", // deviceId
                "", // cpu
                "", // gpu
                ramTotalStr,
                "",
                "",
                "",
                false
            );
#else
            std::string response = ResponseBuilder::BuildStatusResult(
                requestId,
                "Linux / Container",
                false,
                "",
                ""
            );
#endif
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Info("STATUS_RESULT dispatched.");
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

            if (toolId == "tool_perf_power_plan") {
                auto startTime = std::chrono::steady_clock::now();
#ifndef _WIN32
                std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                    requestId,
                    toolId,
                    "INCOMPATIVEL",
                    false,
                    false,
                    "{}",
                    "{}",
                    false,
                    0,
                    "PLATFORM_INCOMPATIBLE: Otimizacao nativa de energia via PowerCfg requer Windows 10 ou Windows 11.",
                    "Falha: Sistema operacional não é Windows."
                );
                g_serverInstance->SendTextMessage(clientSock, response);
                Logger::Instance().Warn("tool_perf_power_plan rejected: Non-Windows platform.");
                break;
#else
                PowerSchemeInfo before = GetActivePowerScheme();
                if (!before.valid) {
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "FALHA",
                        false,
                        false,
                        "{}",
                        "{}",
                        false,
                        0,
                        "Falha ao consultar plano de energia ativo via PowerCfg.",
                        "Erro ao executar PowerCfg no Windows."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                    break;
                }

                g_previousPowerSchemeGuid = before.guid;
                g_previousPowerSchemeName = before.name;

                const std::string highPerfGuid = "8c5e7fda-e8bf-4a96-9a14-5e7d687951d1";

                if (before.guid == highPerfGuid) {
                    auto endTime = std::chrono::steady_clock::now();
                    int64_t dur = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
                    std::string beforeJson = "{\"guid\":\"" + before.guid + "\",\"name\":\"" + before.name + "\"}";
                    std::string afterJson = beforeJson;
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "JA_APLICADO",
                        true,
                        true,
                        beforeJson,
                        afterJson,
                        true,
                        dur,
                        "",
                        "Plano de Alto Desempenho já está ativo no Windows."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                    Logger::Instance().Info("tool_perf_power_plan already applied.");
                    break;
                }

                bool applied = SetActivePowerScheme(highPerfGuid);
                if (!applied) {
                    system("powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a14-5e7d687951d1");
                    applied = SetActivePowerScheme(highPerfGuid);
                }

                PowerSchemeInfo after = GetActivePowerScheme();
                bool verified = (after.valid && after.guid == highPerfGuid);

                auto endTime = std::chrono::steady_clock::now();
                int64_t dur = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();

                std::string beforeJson = "{\"guid\":\"" + before.guid + "\",\"name\":\"" + before.name + "\"}";
                std::string afterJson = "{\"guid\":\"" + after.guid + "\",\"name\":\"" + after.name + "\"}";

                if (verified) {
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "APLICADO",
                        true,
                        true,
                        beforeJson,
                        afterJson,
                        true,
                        dur,
                        "",
                        "Plano de Alto Desempenho aplicado e verificado com sucesso via PowerCfg."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                    Logger::Instance().Info("tool_perf_power_plan applied and verified successfully.");
                } else {
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "FALHA",
                        false,
                        false,
                        beforeJson,
                        afterJson,
                        false,
                        dur,
                        "Falha na verificação do plano de energia via PowerCfg.",
                        "O Windows não confirmou a alteração do plano de energia."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                    Logger::Instance().Error("tool_perf_power_plan verification failed.");
                }
                break;
#endif
            }

            // For all other tools: return honest AINDA NÃO IMPLEMENTADO status with full audit format
            std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                requestId,
                toolId,
                "DISPONIVEL",
                false,
                false,
                "{}",
                "{}",
                false,
                0,
                "AINDA NÃO IMPLEMENTADO: Esta otimização está agendada para as próximas etapas do DYARTE OPTIMIZER.",
                "Rotina nativa em desenvolvimento no Agent."
            );
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Warn("APPLY_OPTIMIZATION: Routine not implemented for tool " + toolId);
            break;
        }

        case MessageType::ROLLBACK_OPTIMIZATION: {
            std::string toolId = json.get_field_string("tool_id", "");
            Logger::Instance().Info("ROLLBACK_OPTIMIZATION received for tool: " + toolId + " (Request ID: " + requestId + ")");

            if (toolId == "tool_perf_power_plan") {
#ifndef _WIN32
                std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                    requestId,
                    toolId,
                    "INCOMPATIVEL",
                    false,
                    false,
                    "{}",
                    "{}",
                    false,
                    0,
                    "PLATFORM_INCOMPATIBLE: Rollback via PowerCfg requer Windows 10 ou Windows 11.",
                    "Falha: Sistema operacional não é Windows."
                );
                g_serverInstance->SendTextMessage(clientSock, response);
                break;
#else
                auto startRollback = std::chrono::steady_clock::now();
                if (g_previousPowerSchemeGuid.empty()) {
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "FALHA",
                        false,
                        false,
                        "{}",
                        "{}",
                        false,
                        0,
                        "Nenhum GUID de plano anterior registrado no backup para reversao.",
                        "Falha: Backup de estado anterior inexistente."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                    break;
                }
                PowerSchemeInfo before = GetActivePowerScheme();
                bool reverted = SetActivePowerScheme(g_previousPowerSchemeGuid);
                PowerSchemeInfo after = GetActivePowerScheme();
                bool verified = (after.valid && after.guid == g_previousPowerSchemeGuid);

                auto endRollback = std::chrono::steady_clock::now();
                int64_t dur = std::chrono::duration_cast<std::chrono::milliseconds>(endRollback - startRollback).count();

                std::string beforeJson = "{\"guid\":\"" + before.guid + "\",\"name\":\"" + before.name + "\"}";
                std::string afterJson = "{\"guid\":\"" + after.guid + "\",\"name\":\"" + after.name + "\"}";

                if (verified) {
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "REVERTIDO",
                        true,
                        true,
                        beforeJson,
                        afterJson,
                        false,
                        dur,
                        "",
                        "Plano de energia restaurado com sucesso para o estado anterior via PowerCfg."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                    Logger::Instance().Info("tool_perf_power_plan rollback verified successfully.");
                } else {
                    std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                        requestId,
                        toolId,
                        "FALHA",
                        false,
                        false,
                        beforeJson,
                        afterJson,
                        true,
                        dur,
                        "Falha ao restaurar plano de energia anterior.",
                        "O Windows não confirmou a restauração do plano de energia anterior."
                    );
                    g_serverInstance->SendTextMessage(clientSock, response);
                }
                break;
#endif
            }

            std::string response = ResponseBuilder::BuildOptimizationAuditResult(
                requestId,
                toolId,
                "DISPONIVEL",
                false,
                false,
                "{}",
                "{}",
                false,
                0,
                "Reversao nao disponivel: nenhuma operacao de baixo nivel foi aplicada anteriormente para " + toolId + ".",
                "Nenhuma alteração registrada para rollback."
            );
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Warn("ROLLBACK_OPTIMIZATION dispatched with status: NOT_APPLIED");
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
#ifdef _WIN32
            std::string ramUsageStr = "null";
            std::string ramUsedMbStr = "null";
            std::string ramTotalMbStr = "null";

            MEMORYSTATUSEX memInfo;
            memInfo.dwLength = sizeof(MEMORYSTATUSEX);
            if (GlobalMemoryStatusEx(&memInfo)) {
                ramUsageStr = std::to_string(memInfo.dwMemoryLoad);
                int64_t totalMb = static_cast<int64_t>(memInfo.ullTotalPhys / (1024 * 1024));
                int64_t availMb = static_cast<int64_t>(memInfo.ullAvailPhys / (1024 * 1024));
                ramTotalMbStr = std::to_string(totalMb);
                ramUsedMbStr = std::to_string(totalMb - availMb);
            }

            static FILETIME prevIdleTime = {0, 0};
            static FILETIME prevKernelTime = {0, 0};
            static FILETIME prevUserTime = {0, 0};
            static bool hasPrevTimes = false;
            std::string cpuUsageStr = "null";

            FILETIME idleTime, kernelTime, userTime;
            if (GetSystemTimes(&idleTime, &kernelTime, &userTime)) {
                if (hasPrevTimes) {
                    auto FileTimeToUint64 = [](const FILETIME& ft) -> uint64_t {
                        return (static_cast<uint64_t>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
                    };
                    uint64_t idleDiff = FileTimeToUint64(idleTime) - FileTimeToUint64(prevIdleTime);
                    uint64_t kernelDiff = FileTimeToUint64(kernelTime) - FileTimeToUint64(prevKernelTime);
                    uint64_t userDiff = FileTimeToUint64(userTime) - FileTimeToUint64(prevUserTime);
                    uint64_t totalDiff = kernelDiff + userDiff;
                    if (totalDiff > 0) {
                        double cpuPercent = (static_cast<double>(totalDiff - idleDiff) / totalDiff) * 100.0;
                        if (cpuPercent < 0.0) cpuPercent = 0.0;
                        if (cpuPercent > 100.0) cpuPercent = 100.0;
                        char buf[32];
                        snprintf(buf, sizeof(buf), "%.1f", cpuPercent);
                        cpuUsageStr = buf;
                    }
                }
                prevIdleTime = idleTime;
                prevKernelTime = kernelTime;
                prevUserTime = userTime;
                hasPrevTimes = true;
            }

            std::string response = ResponseBuilder::BuildTelemetrySnapshot(
                requestId,
                cpuUsageStr,
                "null",
                ramUsageStr,
                "null",
                "null",
                "null",
                "null",
                ramUsedMbStr,
                ramTotalMbStr
            );
#else
            std::string response = ResponseBuilder::BuildTelemetrySnapshot(
                requestId,
                "null", "null", "null", "null", "null", "null", "null", "null", "null"
            );
#endif
            g_serverInstance->SendTextMessage(clientSock, response);
            Logger::Instance().Info("TELEMETRY_SNAPSHOT dispatched.");
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
