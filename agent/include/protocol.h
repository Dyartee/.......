#pragma once

#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
#include "json_helper.h"

namespace Dyarte {
namespace Agent {

struct ProtocolConstants {
    static constexpr int PROTOCOL_VERSION = 1;
    static constexpr const char* AGENT_VERSION = "1.0.0";
    static constexpr size_t MAX_MESSAGE_SIZE = 65536; // 64 KB
    static constexpr const char* DEFAULT_LISTEN_IP = "127.0.0.1";
    static constexpr int DEFAULT_PORT = 49152;
};

enum class MessageType {
    UNKNOWN,
    HANDSHAKE,
    HANDSHAKE_ACK,
    PING,
    PONG,
    TEST_CONNECTION,
    TEST_CONNECTION_RESULT,
    APPLY_OPTIMIZATION,
    ROLLBACK_OPTIMIZATION,
    OPTIMIZATION_RESULT,
    GET_TELEMETRY,
    TELEMETRY_SNAPSHOT,
    EXECUTE_DRIVER_PACKAGE,
    ERROR_RESPONSE
};

inline std::string MessageTypeToString(MessageType type) {
    switch (type) {
        case MessageType::HANDSHAKE: return "HANDSHAKE";
        case MessageType::HANDSHAKE_ACK: return "HANDSHAKE_ACK";
        case MessageType::PING: return "PING";
        case MessageType::PONG: return "PONG";
        case MessageType::TEST_CONNECTION: return "TEST_CONNECTION";
        case MessageType::TEST_CONNECTION_RESULT: return "TEST_CONNECTION_RESULT";
        case MessageType::APPLY_OPTIMIZATION: return "APPLY_OPTIMIZATION";
        case MessageType::ROLLBACK_OPTIMIZATION: return "ROLLBACK_OPTIMIZATION";
        case MessageType::OPTIMIZATION_RESULT: return "OPTIMIZATION_RESULT";
        case MessageType::GET_TELEMETRY: return "GET_TELEMETRY";
        case MessageType::TELEMETRY_SNAPSHOT: return "TELEMETRY_SNAPSHOT";
        case MessageType::EXECUTE_DRIVER_PACKAGE: return "EXECUTE_DRIVER_PACKAGE";
        case MessageType::ERROR_RESPONSE: return "ERROR";
        default: return "UNKNOWN";
    }
}

inline MessageType StringToMessageType(const std::string& str) {
    if (str == "HANDSHAKE") return MessageType::HANDSHAKE;
    if (str == "PING") return MessageType::PING;
    if (str == "TEST_CONNECTION") return MessageType::TEST_CONNECTION;
    if (str == "APPLY_OPTIMIZATION") return MessageType::APPLY_OPTIMIZATION;
    if (str == "ROLLBACK_OPTIMIZATION") return MessageType::ROLLBACK_OPTIMIZATION;
    if (str == "GET_TELEMETRY") return MessageType::GET_TELEMETRY;
    if (str == "EXECUTE_DRIVER_PACKAGE") return MessageType::EXECUTE_DRIVER_PACKAGE;
    return MessageType::UNKNOWN;
}

class SecurityValidator {
public:
    // Rejects payloads that contain forbidden execution keywords
    static bool ContainsForbiddenPatterns(const std::string& raw) {
        std::string lower = raw;
        std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c) {
            return static_cast<char>(std::tolower(c));
        });

        const std::vector<std::string> forbidden = {
            "\"command\"",
            "\"powershell\"",
            "\"script\"",
            "\"shell\"",
            "\"execute\""
        };

        for (const auto& pattern : forbidden) {
            if (lower.find(pattern) != std::string::npos) {
                return true;
            }
        }
        return false;
    }

    static bool ValidateMessageSize(size_t size) {
        return size > 0 && size <= ProtocolConstants::MAX_MESSAGE_SIZE;
    }
};

class ResponseBuilder {
public:
    static std::string BuildHandshakeAck() {
        return "{\"protocol_version\":1,\"type\":\"HANDSHAKE_ACK\",\"agent_version\":\"1.0.0\",\"status\":\"ONLINE\"}";
    }

    static std::string BuildPong(int64_t timestamp) {
        std::stringstream ss;
        ss << "{\"protocol_version\":1,\"type\":\"PONG\",\"timestamp\":" << timestamp << "}";
        return ss.str();
    }

    static std::string BuildTestConnectionResult(const std::string& requestId) {
        std::stringstream ss;
        ss << "{\"protocol_version\":1,\"request_id\":\"" << EscapeString(requestId)
           << "\",\"type\":\"TEST_CONNECTION_RESULT\",\"success\":true,\"agent_version\":\"1.0.0\"}";
        return ss.str();
    }

    static std::string BuildOptimizationResult(
        const std::string& requestId,
        const std::string& toolId,
        const std::string& status,
        bool success,
        const std::string& message
    ) {
        std::stringstream ss;
        ss << "{\"protocol_version\":1"
           << ",\"type\":\"OPTIMIZATION_RESULT\""
           << ",\"request_id\":\"" << EscapeString(requestId) << "\""
           << ",\"tool_id\":\"" << EscapeString(toolId) << "\""
           << ",\"status\":\"" << EscapeString(status) << "\""
           << ",\"success\":" << (success ? "true" : "false")
           << ",\"message\":\"" << EscapeString(message) << "\"}";
        return ss.str();
    }

    static std::string BuildDriverPackageResult(
        const std::string& requestId,
        const std::string& vendor,
        const std::string& status,
        bool success,
        const std::string& message
    ) {
        std::stringstream ss;
        ss << "{\"protocol_version\":1"
           << ",\"type\":\"DRIVER_PACKAGE_RESULT\""
           << ",\"request_id\":\"" << EscapeString(requestId) << "\""
           << ",\"vendor\":\"" << EscapeString(vendor) << "\""
           << ",\"status\":\"" << EscapeString(status) << "\""
           << ",\"success\":" << (success ? "true" : "false")
           << ",\"message\":\"" << EscapeString(message) << "\"}";
        return ss.str();
    }

    static std::string BuildError(const std::string& requestId, const std::string& errorMsg, const std::string& errorCode = "VALIDATION_FAILED") {
        std::stringstream ss;
        ss << "{\"protocol_version\":1";
        if (!requestId.empty()) {
            ss << ",\"request_id\":\"" << EscapeString(requestId) << "\"";
        }
        ss << ",\"type\":\"ERROR\""
           << ",\"error_code\":\"" << EscapeString(errorCode) << "\""
           << ",\"error\":\"" << EscapeString(errorMsg) << "\"}";
        return ss.str();
    }

private:
    static std::string EscapeString(const std::string& s) {
        std::string res;
        for (char c : s) {
            if (c == '"') res += "\\\"";
            else if (c == '\\') res += "\\\\";
            else res.push_back(c);
        }
        return res;
    }
};

} // namespace Agent
} // namespace Dyarte
