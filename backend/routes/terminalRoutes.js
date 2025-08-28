// /backend/routes/terminalRoutes.js
const os = require('os');
const pty = require('node-pty');

// The function to handle a new WebSocket connection
function handleWebSocketConnection(ws, req) {
  console.log('Terminal WebSocket connection established');

  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  const args = [];

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: process.env,
  });

  ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  ws.on('message', (message) => {
    try {
      ptyProcess.write(message.toString());
    } catch (error) {
      console.error('Error writing to terminal process:', error);
    }
  });

  ws.on('close', () => {
    console.log('Terminal WebSocket connection closed');
    ptyProcess.kill();
  });

  ptyProcess.on('exit', (code) => {
    console.log(`Terminal process exited with code ${code}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`\r\nProcess exited with code ${code}\r\n`);
      ws.close();
    }
  });
}

module.exports = {
  handleWebSocketConnection,
};