#pragma once

#include <string>
#include <vector>
#include <chrono>
#include <cstdint>
#include <unordered_map>
#include <mutex>
#include "ed25519_verify.h"
#include "json_helper.h"
#include "logger.h"

namespace Dyarte {
namespace Agent {

// Result of cryptographic token validation
struct TokenValidationResult {
    bool valid = false;
    std::string toolId;
    std::string userId;
    std::string deviceId;
    std::string nonce;
    int64_t exp = 0;
    std::string errorCode;
    std::string error;
};

class TokenValidator {
public:
    // Official public key for DYARTE OPTIMIZER backend execution authority (32-byte Ed25519 raw pubkey)
    // Corresponds to public key hex: 6412366338ce65c1d1f9792847def61e9b052d357ea26d5252d34c9c16aaf00d
    static const uint8_t* GetServerPublicKey() {
        static const uint8_t kServerPubKey[32] = {
            0x64, 0x12, 0x36, 0x63, 0x38, 0xce, 0x65, 0xc1,
            0xd1, 0xf9, 0x79, 0x28, 0x47, 0xde, 0xf6, 0x1e,
            0x9b, 0x05, 0x2d, 0x35, 0x7e, 0xa2, 0x6d, 0x52,
            0x52, 0xd3, 0x4c, 0x9c, 0x16, 0xaa, 0xf0, 0x0d
        };
        return kServerPubKey;
    }

    static std::vector<uint8_t> Base64UrlDecode(const std::string& input) {
        std::string base64 = input;
        for (char& c : base64) {
            if (c == '-') c = '+';
            else if (c == '_') c = '/';
        }
        while (base64.size() % 4 != 0) {
            base64.push_back('=');
        }

        static const int8_t table[256] = {
            -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
            -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
            -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
            52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
            -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
            15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
            -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
            41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1
        };

        std::vector<uint8_t> out;
        out.reserve((base64.size() / 4) * 3);

        uint32_t val = 0;
        int valb = -8;
        for (uint8_t c : base64) {
            if (c == '=') break;
            int8_t v = table[c];
            if (v == -1) continue;
            val = (val << 6) | v;
            valb += 6;
            if (valb >= 0) {
                out.push_back(static_cast<uint8_t>((val >> valb) & 0xFF));
                valb -= 8;
            }
        }
        return out;
    }

    /**
     * Checks if a nonce was already consumed (replay protection).
     * If not consumed, stores the nonce until expiration.
     */
    static bool CheckAndConsumeNonce(const std::string& nonce, int64_t exp) {
        if (nonce.empty()) return false;

        static std::unordered_map<std::string, int64_t> s_consumedNonces;
        static std::mutex s_nonceMutex;
        static const size_t kMaxNonces = 10000;

        std::lock_guard<std::mutex> lock(s_nonceMutex);

        auto nowSec = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();

        // Periodic cleanup of expired nonces
        if (s_consumedNonces.size() > 500) {
            for (auto it = s_consumedNonces.begin(); it != s_consumedNonces.end(); ) {
                if (it->second < nowSec - 60) {
                    it = s_consumedNonces.erase(it);
                } else {
                    ++it;
                }
            }
        }

        // Hard cap on memory size
        if (s_consumedNonces.size() >= kMaxNonces) {
            s_consumedNonces.clear();
        }

        // Replay check
        if (s_consumedNonces.find(nonce) != s_consumedNonces.end()) {
            return false; // Replay detected!
        }

        s_consumedNonces[nonce] = exp;
        return true;
    }

    /**
     * Validates an optimization execution token against the expected toolId and device.
     * Format: <base64url(payload)>.<base64url(signature)>
     */
    static TokenValidationResult ValidateToken(
        const std::string& expectedToolId,
        const std::string& tokenStr,
        const std::string& localDeviceId = ""
    ) {
        TokenValidationResult res;

        if (tokenStr.empty()) {
            res.errorCode = "INVALID_TOKEN";
            res.error = "Token de autorizacao ausente no payload.";
            return res;
        }

        size_t dotPos = tokenStr.find('.');
        if (dotPos == std::string::npos) {
            res.errorCode = "INVALID_TOKEN";
            res.error = "Formato de token invalido: ausente delimitador de assinatura.";
            return res;
        }

        std::string payloadB64 = tokenStr.substr(0, dotPos);
        std::string sigB64 = tokenStr.substr(dotPos + 1);

        std::vector<uint8_t> payloadBytes = Base64UrlDecode(payloadB64);
        std::vector<uint8_t> sigBytes = Base64UrlDecode(sigB64);

        if (payloadBytes.empty() || sigBytes.size() != 64) {
            res.errorCode = "INVALID_TOKEN";
            res.error = "Comprimento ou decodificacao de assinatura invalida.";
            return res;
        }

        // 1. Verify cryptographic signature with embedded public key
        bool sigValid = Ed25519::Verify(sigBytes.data(), payloadBytes.data(), payloadBytes.size(), GetServerPublicKey());
        if (!sigValid) {
            Logger::Instance().Warn("[Security] Cryptographic signature check FAILED for optimization token.");
            res.errorCode = "TOKEN_SIGNATURE_INVALID";
            res.error = "Assinatura criptografica do servidor rejeitada.";
            return res;
        }

        // 2. Parse payload JSON
        std::string payloadStr(reinterpret_cast<const char*>(payloadBytes.data()), payloadBytes.size());
        JsonValue payloadJson = JsonValue::parse(payloadStr);

        if (!payloadJson.is_object()) {
            res.errorCode = "INVALID_TOKEN";
            res.error = "Conteudo de token assinado nao e um JSON valido.";
            return res;
        }

        int64_t protocolVersion = payloadJson.get_field_int64("protocol_version", 1);
        if (protocolVersion != 1) {
            res.errorCode = "PROTOCOL_MISMATCH";
            res.error = "Versao de protocolo do token incompativel.";
            return res;
        }

        res.toolId = payloadJson.get_field_string("tool_id", "");
        res.userId = payloadJson.get_field_string("user_id", "");
        res.deviceId = payloadJson.get_field_string("device_id", "");
        res.nonce = payloadJson.get_field_string("nonce", "");
        res.exp = payloadJson.get_field_int64("exp", 0);

        // 3. Validate tool_id matching
        if (res.toolId != expectedToolId) {
            res.errorCode = "TOKEN_TOOL_MISMATCH";
            res.error = "Token emitido para ferramenta '" + res.toolId + "' nao corresponde a ferramenta solicitada '" + expectedToolId + "'.";
            return res;
        }

        // 4. Validate user_id present
        if (res.userId.empty()) {
            res.errorCode = "TOKEN_USER_MISMATCH";
            res.error = "Token de autorizacao sem identificador de usuario valido.";
            return res;
        }

        // 5. Validate device_id matching if both are present
        if (!localDeviceId.empty() && !res.deviceId.empty() && res.deviceId != "N/D" && localDeviceId != "N/D") {
            if (res.deviceId != localDeviceId) {
                res.errorCode = "DEVICE_MISMATCH";
                res.error = "Dispositivo do token ('" + res.deviceId + "') nao corresponde ao identificador do Agent ('" + localDeviceId + "').";
                return res;
            }
        }

        // 6. Validate expiration with 15-second clock skew grace period
        auto nowSec = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();

        if (res.exp < (nowSec - 15)) {
            res.errorCode = "TOKEN_EXPIRED";
            res.error = "Token de autorizacao expirado no servidor.";
            return res;
        }

        // 7. Validate nonce and check for replay
        if (res.nonce.empty() || !CheckAndConsumeNonce(res.nonce, res.exp)) {
            res.errorCode = "TOKEN_REPLAY";
            res.error = "Token de autorizacao ja consumido anteriormente (replay detectado).";
            return res;
        }

        res.valid = true;
        return res;
    }
};

} // namespace Agent
} // namespace Dyarte
