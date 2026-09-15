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
        case MessageType::ERROR_RESPONSE: return "ERROR";
        default: return "UNKNOWN";
    }
}

inline MessageType StringToMessageType(const std::string& str) {
    if (str == "HANDSHAKE") return MessageType::HANDSHAKE;
    if (str == "PING") return MessageType::PING;
    if (str == "TEST_CONNECTION") return MessageType::TEST_CONNECTION;
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

    static std::string BuildError(const std::string& requestId, const std::string& errorMsg) {
        std::stringstream ss;
        ss << "{\"protocol_version\":1";
        if (!requestId.empty()) {
            ss << ",\"request_id\":\"" << EscapeString(requestId) << "\"";
        }
        ss << ",\"type\":\"ERROR\",\"error\":\"" << EscapeString(errorMsg) << "\"}";
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
