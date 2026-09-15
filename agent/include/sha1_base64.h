#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include <cstring>
#include <sstream>
#include <iomanip>

namespace Dyarte {
namespace Agent {

class Base64 {
public:
    static std::string Encode(const unsigned char* data, size_t len) {
        static const char* kChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        std::string out;
        out.reserve(((len + 2) / 3) * 4);

        for (size_t i = 0; i < len; i += 3) {
            uint32_t b = (data[i] << 16);
            if (i + 1 < len) b |= (data[i + 1] << 8);
            if (i + 2 < len) b |= (data[i + 2]);

            out.push_back(kChars[(b >> 18) & 0x3F]);
            out.push_back(kChars[(b >> 12) & 0x3F]);
            out.push_back((i + 1 < len) ? kChars[(b >> 6) & 0x3F] : '=');
            out.push_back((i + 2 < len) ? kChars[b & 0x3F] : '=');
        }
        return out;
    }
};

class Sha1 {
public:
    static std::vector<uint8_t> Compute(const std::string& input) {
        uint32_t h0 = 0x67452301;
        uint32_t h1 = 0xEFCDAB89;
        uint32_t h2 = 0x98BADCFE;
        uint32_t h3 = 0x10325476;
        uint32_t h4 = 0xC3D2E1F0;

        uint64_t originalBitLen = static_cast<uint64_t>(input.size()) * 8;

        std::vector<uint8_t> data(input.begin(), input.end());
        data.push_back(0x80);

        while ((data.size() % 64) != 56) {
            data.push_back(0x00);
        }

        for (int i = 7; i >= 0; i--) {
            data.push_back(static_cast<uint8_t>((originalBitLen >> (i * 8)) & 0xFF));
        }

        for (size_t chunk = 0; chunk < data.size(); chunk += 64) {
            uint32_t w[80];
            for (int i = 0; i < 16; i++) {
                w[i] = (static_cast<uint32_t>(data[chunk + i * 4]) << 24) |
                       (static_cast<uint32_t>(data[chunk + i * 4 + 1]) << 16) |
                       (static_cast<uint32_t>(data[chunk + i * 4 + 2]) << 8) |
                       (static_cast<uint32_t>(data[chunk + i * 4 + 3]));
            }
            for (int i = 16; i < 80; i++) {
                w[i] = LeftRotate(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
            }

            uint32_t a = h0;
            uint32_t b = h1;
            uint32_t c = h2;
            uint32_t d = h3;
            uint32_t e = h4;

            for (int i = 0; i < 80; i++) {
                uint32_t f = 0;
                uint32_t k = 0;

                if (i < 20) {
                    f = (b & c) | ((~b) & d);
                    k = 0x5A827999;
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ED9EBA1;
                } else if (i < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8F1BBCDC;
                } else {
                    f = b ^ c ^ d;
                    k = 0xCA62C1D6;
                }

                uint32_t temp = LeftRotate(a, 5) + f + e + k + w[i];
                e = d;
                d = c;
                c = LeftRotate(b, 30);
                b = a;
                a = temp;
            }

            h0 += a;
            h1 += b;
            h2 += c;
            h3 += d;
            h4 += e;
        }

        std::vector<uint8_t> hash(20);
        for (int i = 0; i < 4; i++) {
            hash[i]      = static_cast<uint8_t>((h0 >> (24 - i * 8)) & 0xFF);
            hash[i + 4]  = static_cast<uint8_t>((h1 >> (24 - i * 8)) & 0xFF);
            hash[i + 8]  = static_cast<uint8_t>((h2 >> (24 - i * 8)) & 0xFF);
            hash[i + 12] = static_cast<uint8_t>((h3 >> (24 - i * 8)) & 0xFF);
            hash[i + 16] = static_cast<uint8_t>((h4 >> (24 - i * 8)) & 0xFF);
        }
        return hash;
    }

private:
    static inline uint32_t LeftRotate(uint32_t val, int bits) {
        return (val << bits) | (val >> (32 - bits));
    }
};

} // namespace Agent
} // namespace Dyarte
