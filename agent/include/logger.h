#pragma once

#include <iostream>
#include <fstream>
#include <string>
#include <mutex>
#include <chrono>
#include <iomanip>
#include <sstream>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#else
#include <sys/stat.h>
#include <sys/types.h>
#endif

namespace Dyarte {
namespace Agent {

enum class LogLevel {
    INFO,
    WARN,
    ERR,
    DEBUG
};

class Logger {
public:
    static Logger& Instance() {
        static Logger instance;
        return instance;
    }

    void Initialize(const std::string& logFilePath = "logs/dyarte-agent.log") {
        std::lock_guard<std::mutex> lock(mutex_);
        EnsureLogsDirectory();
        logFile_.open(logFilePath, std::ios::out | std::ios::app);
        if (!logFile_.is_open()) {
            std::cerr << "[LOG ERROR] Could not open log file: " << logFilePath << std::endl;
        }
    }

    void Shutdown() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (logFile_.is_open()) {
            logFile_.flush();
            logFile_.close();
        }
    }

    void Log(LogLevel level, const std::string& message) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::string timestamp = GetCurrentTimestamp();
        std::string levelStr = LevelToString(level);

        std::string formatted = "[" + timestamp + "] [" + levelStr + "] " + message;

        // Output to console
        std::cout << formatted << std::endl;

        // Output to log file
        if (logFile_.is_open()) {
            logFile_ << formatted << std::endl;
            logFile_.flush();
        }
    }

    void Info(const std::string& msg) { Log(LogLevel::INFO, msg); }
    void Warn(const std::string& msg) { Log(LogLevel::WARN, msg); }
    void Error(const std::string& msg) { Log(LogLevel::ERR, msg); }
    void Debug(const std::string& msg) { Log(LogLevel::DEBUG, msg); }

private:
    Logger() = default;
    ~Logger() { Shutdown(); }

    std::mutex mutex_;
    std::ofstream logFile_;

    void EnsureLogsDirectory() {
#ifdef _WIN32
        CreateDirectoryA("logs", NULL);
#else
        mkdir("logs", 0755);
#endif
    }

    std::string GetCurrentTimestamp() {
        auto now = std::chrono::system_clock::now();
        auto in_time_t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

        std::stringstream ss;
        struct tm timeinfo;
#ifdef _WIN32
        localtime_s(&timeinfo, &in_time_t);
#else
        localtime_r(&in_time_t, &timeinfo);
#endif
        ss << std::put_time(&timeinfo, "%Y-%m-%d %H:%M:%S")
           << "." << std::setfill('0') << std::setw(3) << ms.count();
        return ss.str();
    }

    std::string LevelToString(LogLevel level) {
        switch (level) {
            case LogLevel::INFO:  return "INFO ";
            case LogLevel::WARN:  return "WARN ";
            case LogLevel::ERR:   return "ERROR";
            case LogLevel::DEBUG: return "DEBUG";
            default:              return "LOG  ";
        }
    }
};

} // namespace Agent
} // namespace Dyarte
