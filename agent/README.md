# DYARTE Windows Agent V1

Agente nativo do Windows para o **DYARTE OPTIMIZER**.

Responsável por fornecer telemetria em tempo real e orquestrar operações locais no sistema operacional Windows através de um canal WebSocket local seguro.

---

## 1. Visão Geral e Arquitetura

* **Tecnologia:** C++17 nativo
* **Bibliotecas de Rede:** WinSock2 (`ws2_32.lib`)
* **Criptografia/Handshake:** Win32 CryptoAPI e implementação nativa SHA-1/Base64 (`crypt32.lib`)
* **Dependências Externas:** **Zero**. Executável 100% autônomo, sem dependência do .NET Runtime ou bibliotecas de terceiros.
* **Interface de Rede:** Estritamente `127.0.0.1:49152` (Loopback local). Não escuta em `0.0.0.0` e rejeita qualquer tentativa de conexão externa.
* **Logs Locais:** Gravados continuamente em `logs/dyarte-agent.log`.

---

## 2. Estrutura de Arquivos

```text
agent/
├── CMakeLists.txt              # Configuração do projeto CMake
├── build.bat                   # Script automatizado de compilação para Windows
├── README.md                   # Documentação oficial do agente
├── include/
│   ├── logger.h                # Sistema de log thread-safe (console + arquivo)
│   ├── json_helper.h           # Leitor e validador JSON sem dependências
│   ├── protocol.h              # Especificação de protocolo, whitelists e validação
│   ├── sha1_base64.h           # Algoritmos criptográficos RFC 6455
│   └── websocket_server.h      # Servidor WebSocket RFC 6455 em loopback
└── src/
    ├── main.cpp                # Ponto de entrada, ciclo de vida e tratamento de sinais
    └── websocket_server.cpp    # Implementação de sockets e framing RFC 6455
```

---

## 3. Protocolo de Comunicação (V1)

Todas as mensagens transitam em formato JSON delimitado por frames RFC 6455.

### 3.1 Handshake Inicial
**Cliente (React UI):**
```json
{
  "protocol_version": 1,
  "type": "HANDSHAKE",
  "client": "DYARTE_OPTIMIZER"
}
```
**Agente (`dyarte-agent.exe`):**
```json
{
  "protocol_version": 1,
  "type": "HANDSHAKE_ACK",
  "agent_version": "1.0.0",
  "status": "ONLINE"
}
```

### 3.2 Heartbeat (Ping / Pong)
**Cliente:**
```json
{
  "protocol_version": 1,
  "type": "PING",
  "timestamp": 1715000000
}
```
**Agente:**
```json
{
  "protocol_version": 1,
  "type": "PONG",
  "timestamp": 1715000000
}
```

### 3.3 Teste de Conectividade Segura (`TEST_CONNECTION`)
**Cliente:**
```json
{
  "protocol_version": 1,
  "request_id": "req-9842a1",
  "type": "TEST_CONNECTION"
}
```
**Agente:**
```json
{
  "protocol_version": 1,
  "request_id": "req-9842a1",
  "type": "TEST_CONNECTION_RESULT",
  "success": true,
  "agent_version": "1.0.0"
}
```

---

## 4. Segurança

1. **Whitelist Rigorosa de Tipos:** Apenas os tipos `HANDSHAKE`, `PING` e `TEST_CONNECTION` são aceitos.
2. **Bloqueio de Comandos Arbitrários:** Qualquer payload contendo termos como `"command"`, `"powershell"`, `"script"`, `"shell"` ou `"execute"` é rejeitado imediatamente com registro de auditoria.
3. **Limite de Tamanho:** Payloads acima de 64 KB são descartados.
4. **Isolamento de Rede:** O socket faz bind exclusivo em `127.0.0.1`.

---

## 5. Como Compilar no Windows

### Pré-requisitos:
* Windows 10 ou Windows 11 (64-bit)
* **Visual Studio 2022** (Community, Professional ou Build Tools) com a carga de trabalho *"Desenvolvimento para desktop com C++"* instalada.
* CMake 3.15+ (opcional, já incluído no instalador do Visual Studio).

### Método 1 — Via `build.bat` (Automático):
1. Abra o **Developer Command Prompt for VS 2022** (ou *x64 Native Tools Command Prompt*).
2. Navegue até o diretório `agent/`:
   ```cmd
   cd caminho\para\dyarte-optimizer\agent
   build.bat
   ```
3. O executável será gerado em:
   ```text
   agent\build\Release\dyarte-agent.exe
   ```

### Método 2 — Via CMake Manual:
```cmd
cd agent
cmake -B build -A x64
cmake --build build --config Release
```

### Método 3 — Compilação Direta via MSVC (`cl.exe`):
```cmd
cd agent
mkdir build\Release
cl.exe /nologo /W3 /EHsc /std:c++17 /O2 /DNDEBUG /I include src\main.cpp src\websocket_server.cpp ws2_32.lib crypt32.lib /Fe:build\Release\dyarte-agent.exe
```

---

## 6. Como Executar e Testar

### 6.1 Execução:
Execute o binário compilado:
```cmd
cd agent\build\Release
dyarte-agent.exe
```

Saída esperada no console:
```text
========================================
DYARTE AGENT
Version: 1.0.0
Status: STARTING
========================================
Status: ONLINE
Listening exclusively on 127.0.0.1:49152
Press Ctrl+C to stop the agent.
========================================
```

### 6.2 Encerramento Seguro:
Pressione `Ctrl+C` na janela do console do agente. O agente encerrará os sockets e threads de forma limpa, gravando o encerramento em `logs/dyarte-agent.log`.
