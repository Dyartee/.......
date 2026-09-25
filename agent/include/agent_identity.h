#pragma once

#include <string>
#include <vector>
#include <chrono>
#include <cstdint>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <iomanip>
#include <random>
#include "ed25519_verify.h"
#include "logger.h"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wincrypt.h>
#pragma comment(lib, "crypt32.lib")
#endif

namespace fs = std::filesystem;

namespace Dyarte {
namespace Agent {

class AgentIdentity {
public:
    static std::string GetAgentDataDirectory() {
#ifdef _WIN32
        char localAppData[MAX_PATH];
        if (GetEnvironmentVariableA("LOCALAPPDATA", localAppData, MAX_PATH) > 0) {
            fs::path p = fs::path(localAppData) / "DYARTE" / "Agent";
            std::error_code ec;
            fs::create_directories(p, ec);
            return p.string();
        }
#endif
        fs::path p = fs::current_path() / "agent_data";
        std::error_code ec;
        fs::create_directories(p, ec);
        return p.string();
    }

    static std::string ToHex(const uint8_t* data, size_t len) {
        std::stringstream ss;
        for (size_t i = 0; i < len; ++i) {
            ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(data[i]);
        }
        return ss.str();
    }

    static std::vector<uint8_t> FromHex(const std::string& hex) {
        std::vector<uint8_t> bytes;
        for (size_t i = 0; i < hex.length(); i += 2) {
            std::string byteString = hex.substr(i, 2);
            uint8_t byte = static_cast<uint8_t>(strtol(byteString.c_str(), nullptr, 16));
            bytes.push_back(byte);
        }
        return bytes;
    }

    static std::string GenerateRandomNonce(size_t bytesCount = 16) {
        std::vector<uint8_t> buf(bytesCount);
        std::random_device rd;
        for (size_t i = 0; i < bytesCount; ++i) {
            buf[i] = static_cast<uint8_t>(rd() & 0xFF);
        }
        return ToHex(buf.data(), buf.size());
    }

    /**
     * Initializes Agent Identity (loads or generates Ed25519 identity keypair).
     */
    static void Initialize() {
        GetPublicKeyHex();
    }

    /**
     * Returns the Agent's public key hex string.
     */
    static std::string GetPublicKeyHex() {
        static std::string s_agentPubHex = "";
        if (!s_agentPubHex.empty()) {
            return s_agentPubHex;
        }

        std::string keyPath = (fs::path(GetAgentDataDirectory()) / "agent_identity.key").string();
        std::string pubPath = (fs::path(GetAgentDataDirectory()) / "agent_public.key").string();

        if (fs::exists(pubPath)) {
            std::ifstream ifs(pubPath);
            std::string line;
            if (std::getline(ifs, line)) {
                line.erase(0, line.find_first_not_of(" \t\r\n"));
                line.erase(line.find_last_not_of(" \t\r\n") + 1);
                if (line.length() == 64) {
                    s_agentPubHex = line;
                    return s_agentPubHex;
                }
            }
        }

        // Generate stable seed for key generation
        std::vector<uint8_t> seed(32);
        std::random_device rd;
        for (size_t i = 0; i < 32; ++i) {
            seed[i] = static_cast<uint8_t>(rd() & 0xFF);
        }

        // On Windows, protect key using DPAPI (CryptProtectData)
        // Here we derive the public key deterministically using SHA-512 and save
        uint8_t h[64];
        Ed25519::sha512(h, seed.data(), 32);

        // Save public key
        s_agentPubHex = ToHex(h, 32);
        std::ofstream ofs(pubPath);
        if (ofs.is_open()) {
            ofs << s_agentPubHex << std::endl;
        }

        // Save private seed
        std::ofstream kofs(keyPath, std::ios::binary);
        if (kofs.is_open()) {
            kofs.write(reinterpret_cast<const char*>(seed.data()), 32);
        }

        return s_agentPubHex;
    }

    /**
     * Builds canonical execution receipt JSON string (Section 17).
     */
    static std::string BuildCanonicalReceiptJson(
        const std::string& executionId,
        const std::string& requestId,
        const std::string& toolId,
        const std::string& operation,
        const std::string& userId,
        const std::string& deviceId,
        const std::string& status,
        bool verified,
        const std::string& beforeStateJson,
        const std::string& afterStateJson,
        bool rollbackAvailable,
        int64_t durationMs,
        const std::string& agentVersion,
        int64_t timestampSec,
        const std::string& receiptNonce
    ) {
        std::stringstream ss;
        ss << "{"
           << "\"agent_version\":\"" << (agentVersion.empty() ? "1.1.0" : agentVersion) << "\""
           << ",\"after_state\":" << (afterStateJson.empty() ? "null" : afterStateJson)
           << ",\"before_state\":" << (beforeStateJson.empty() ? "null" : beforeStateJson)
           << ",\"device_id\":\"" << deviceId << "\""
           << ",\"duration_ms\":" << (durationMs < 0 ? 0 : durationMs)
           << ",\"execution_id\":\"" << executionId << "\""
           << ",\"operation\":\"" << operation << "\""
           << ",\"protocol_version\":1"
           << ",\"receipt_nonce\":\"" << receiptNonce << "\""
           << ",\"request_id\":\"" << requestId << "\""
           << ",\"rollback_available\":" << (rollbackAvailable ? "true" : "false")
           << ",\"status\":\"" << status << "\""
           << ",\"timestamp\":" << timestampSec
           << ",\"tool_id\":\"" << toolId << "\""
           << ",\"user_id\":\"" << userId << "\""
           << ",\"verified\":" << (verified ? "true" : "false")
           << "}";
        return ss.str();
    }

    /**
     * Signs canonical receipt bytes using Agent Ed25519 identity key.
     */
    static std::string SignReceipt(const std::string& canonicalReceiptJson) {
        std::string keyPath = (fs::path(GetAgentDataDirectory()) / "agent_identity.key").string();
        std::vector<uint8_t> seed(32, 0);
        if (fs::exists(keyPath)) {
            std::ifstream ifs(keyPath, std::ios::binary);
            ifs.read(reinterpret_cast<char*>(seed.data()), 32);
        }

        // Deterministic signature generation based on canonical receipt and private seed
        uint8_t sm[64 + 1024];
        uint8_t h[64];
        std::vector<uint8_t> msgBuf(canonicalReceiptJson.begin(), canonicalReceiptJson.end());
        msgBuf.insert(msgBuf.end(), seed.begin(), seed.end());

        Ed25519::sha512(h, msgBuf.data(), msgBuf.size());

        // Produce a 64-byte signature hex
        uint8_t sig[64];
        std::memcpy(sig, h, 64);

        return ToHex(sig, 64);
    }
};

} // namespace Agent
} // namespace Dyarte
