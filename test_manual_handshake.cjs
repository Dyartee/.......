// Teste manual TCP/WebSocket Handshake sem depender da UI
const net = require('net');
const crypto = require('crypto');

const HOST = '127.0.0.1';
const PORT = 49152;
const SEC_KEY = 'SGVsbG9XU29ja2V0S2V5MTIz';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const EXPECTED_ACCEPT = crypto
  .createHash('sha1')
  .update(SEC_KEY + WS_GUID)
  .digest('base64');

console.log('========================================');
console.log('TESTE MANUAL: TCP / HTTP WEBSOCKET HANDSHAKE');
console.log(`Conectando em ${HOST}:${PORT}...`);
console.log('========================================');

const client = new net.Socket();

const handshakeRequest =
  'GET / HTTP/1.1\r\n' +
  `Host: ${HOST}:${PORT}\r\n` +
  'Upgrade: websocket\r\n' +
  'Connection: Upgrade\r\n' +
  `Sec-WebSocket-Key: ${SEC_KEY}\r\n` +
  'Sec-WebSocket-Version: 13\r\n\r\n';

let responseData = '';

client.connect(PORT, HOST, () => {
  console.log('[CLIENT] TCP Conectado com sucesso ao Agent em', `${HOST}:${PORT}`);
  console.log('[CLIENT] Enviando WebSocket Handshake manual:');
  console.log(handshakeRequest.trim());
  console.log('----------------------------------------');
  client.write(handshakeRequest);
});

client.on('data', (data) => {
  responseData += data.toString();
  console.log('[CLIENT] Resposta recebida do Agent:');
  console.log(responseData.trim());
  console.log('----------------------------------------');

  const has101 = responseData.includes('HTTP/1.1 101 Switching Protocols');
  const hasUpgrade = /Upgrade:\s*websocket/i.test(responseData);
  const hasConnection = /Connection:\s*Upgrade/i.test(responseData);
  const hasAccept = responseData.includes(`Sec-WebSocket-Accept: ${EXPECTED_ACCEPT}`);

  console.log('[VERIFICAÇÃO]');
  console.log(' - HTTP 101 Switching Protocols:', has101 ? 'OK (Pass)' : 'FALHA');
  console.log(' - Upgrade: websocket:', hasUpgrade ? 'OK (Pass)' : 'FALHA');
  console.log(' - Connection: Upgrade:', hasConnection ? 'OK (Pass)' : 'FALHA');
  console.log(` - Sec-WebSocket-Accept (${EXPECTED_ACCEPT}):`, hasAccept ? 'OK (Pass)' : 'FALHA');

  if (has101 && hasUpgrade && hasConnection && hasAccept) {
    console.log('========================================');
    console.log('RESULTADO: TESTE MANUAL PASSOU COM SUCESSO 100%!');
    console.log('TCP: OK');
    console.log('HTTP WebSocket Handshake: OK');
    console.log('Agent: OK');
    console.log('========================================');
    client.end();
    process.exit(0);
  } else {
    console.error('RESULTADO: FALHA NA RESPOSTA DO AGENT!');
    client.end();
    process.exit(1);
  }
});

client.on('error', (err) => {
  console.error('[CLIENT ERROR] Falha no socket TCP:', err.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('[CLIENT] Conexão TCP encerrada.');
});

setTimeout(() => {
  console.error('[TIMEOUT] Nenhuma resposta recebida do Agent após 5 segundos.');
  client.destroy();
  process.exit(1);
}, 5000);
