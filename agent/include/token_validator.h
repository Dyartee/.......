#pragma once

#include <string>
#include <vector>
#include <chrono>
#include <cstdint>
#include "ed25519_verify.h"
#include "json_helper.h"
#include "logger.h"

namespace Dyarte {
namespace Agent {

// Result of token validation
struct TokenValidationResult {
    bool valid = false;
    std::string toolId;
    std::string userId;
    std::string nonce;
    int64_t exp = 0;
    std::string error;
};

class TokenValidator {
public:
    // Official public key for DYARTE OPTIMIZER backend execution authority (32-byte Ed25519 raw pubkey)
    static const uint8_t* GetServerPublicKey() {
        static const uint8_t kServerPubKey[32] = {
            0x8f, 0xb7, 0x58, 0x71, 0x0c, 0x6a, 0xd3, 0xe9,
            0x47, 0x65, 0x68, 0xd5, 0xea, 0x8c, 0x20, 0x63,
            0xaa, 0x54, 0x6b, 0x44, 0x71, 0x1f, 0x54, 0x01,
            0x17, 0x65, 0xb8, 0x9d, 0x99, 0x46, 0x63, 0xde
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
     * Validates an optimization execution token against the expected toolId.
     * Format: <base64url(payload)>.<base64url(signature)>
     */
    static TokenValidationResult ValidateToken(const std::string& expectedToolId, const std::string& tokenStr) {
        TokenValidationResult res;

        if (tokenStr.empty()) {
            res.error = "Token de autorizacao ausente no payload.";
            return res;
        }

        size_t dotPos = tokenStr.find('.');
        if (dotPos == std::string::npos) {
            res.error = "Formato de token invalido: ausente delimitador de assinatura.";
            return res;
        }

        std::string payloadB64 = tokenStr.substr(0, dotPos);
        std::string sigB64 = tokenStr.substr(dotPos + 1);

        std::vector<uint8_t> payloadBytes = Base64UrlDecode(payloadB64);
        std::vector<uint8_t> sigBytes = Base64UrlDecode(sigB64);

        if (payloadBytes.empty() || sigBytes.size() != 64) {
            res.error = "Comprimento ou decodificacao de assinatura invalida.";
            return res;
        }

        // Verify cryptographic signature with embedded public key
        bool sigValid = Ed25519::Verify(sigBytes.data(), payloadBytes.data(), payloadBytes.size(), GetServerPublicKey());
        if (!sigValid) {
            Logger::Instance().Warn("[Security] Cryptographic signature check FAILED for optimization token.");
            res.error = "Assinatura criptografica do servidor rejeitada.";
            return res;
        }

        // Parse payload JSON
        std::string payloadStr(reinterpret_cast<const char*>(payloadBytes.data()), payloadBytes.size());
        JsonValue payloadJson = JsonValue::parse(payloadStr);

        if (!payloadJson.is_object()) {
            res.error = "Conteudo de token assinado nao e um JSON valido.";
            return res;
        }

        res.toolId = payloadJson.get_field_string("tool_id", "");
        res.userId = payloadJson.get_field_string("user_id", "");
        res.nonce = payloadJson.get_field_string("nonce", "");
        res.exp = payloadJson.get_field_int64("exp", 0);

        if (res.toolId != expectedToolId) {
            res.error = "Token emitido para ferramenta '" + res.toolId + "' nao corresponde a ferramenta solicitada '" + expectedToolId + "'.";
            return res;
        }

        auto nowSec = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();

        // Grace period of 15 seconds for clock skew
        if (res.exp < (nowSec - 15)) {
            res.error = "Token de autorizacao expirado no servidor.";
            return res;
        }

        res.valid = true;
        return res;
    }
};

} // namespace Agent
} // namespace Dyarte
