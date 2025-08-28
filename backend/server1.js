// /backend/server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

// Import the modularized routes
const configRoutes = require('./routes/configRoutes');
const dockerRoutes = require('./routes/dockerRoutes');
const logRoutes = require('./routes/logRoutes');
const { handleWebSocketConnection } = require('./routes/terminalRoutes');

const app = express();
const PORT = 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Main API routes
app.use('/api', configRoutes);
app.use('/api', dockerRoutes);
app.use('/api', logRoutes);

// Other API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HUMMINGBIRD backend is running' });
});

app.post('/api/up-recipe/deploy', (req, res) => {
  // Your existing /api/up-recipe/deploy logic goes here
  // ...
  const recipeDir = '/home/kavindu-janith/platformrecipe';
  const deployCmd = 'sbt --client personal:deploy -y';
  const fullCmd = `cd "${recipeDir}" && ${deployCmd}`;
  exec(fullCmd, { cwd: recipeDir }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: stderr || error.message,
        stdout,
      });
    }
    res.json({
      success: true,
      message: 'UP-RECIPE deploy executed',
      stdout,
    });
  });
});

// Create HTTP server from the Express app
const server = http.createServer(app);

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on('connection', handleWebSocketConnection);

// Handle HTTP upgrade requests and route them to the WebSocket server
server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    if (pathname === '/terminal') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Start the combined HTTP and WebSocket server
server.listen(PORT, () => {
    console.log(`HUMMINGBIRD backend server running on http://localhost:${PORT}`);
    console.log(`WebSocket terminal server is available at ws://localhost:${PORT}/terminal`);
});