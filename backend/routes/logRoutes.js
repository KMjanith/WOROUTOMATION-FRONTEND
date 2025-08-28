// /backend/routes/logRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// API endpoint to get log directories
router.get('/logs/directories', (req, res) => {
  // Your existing /api/logs/directories logic goes here
  // ...
  try {
    const logBasePath = '/home/kavindu-janith/po/var/log/services';
    if (!fs.existsSync(logBasePath)) {
      return res.status(404).json({
        success: false,
        error: 'Log services directory not found',
        path: logBasePath
      });
    }
    const items = fs.readdirSync(logBasePath, { withFileTypes: true });
    const directories = items
      .filter(item => item.isDirectory())
      .map(dir => ({
        name: dir.name,
        path: path.join(logBasePath, dir.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      success: true,
      data: directories,
      basePath: logBasePath
    });
  } catch (error) {
    console.error('Error reading log directories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read log directories',
      details: error.message
    });
  }
});

// API endpoint to get log files for a specific service
router.get('/logs/files/:serviceName', (req, res) => {
  // Your existing /api/logs/files/:serviceName logic goes here
  // ...
  try {
    const serviceName = req.params.serviceName;
    const servicePath = path.join('/home/kavindu-janith/po/var/log/services', serviceName);
    if (serviceName.includes('..') || serviceName.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service name'
      });
    }
    if (!fs.existsSync(servicePath)) {
      return res.status(404).json({
        success: false,
        error: 'Service directory not found',
        path: servicePath
      });
    }
    const items = fs.readdirSync(servicePath, { withFileTypes: true });
    const files = items
      .filter(item => item.isFile())
      .map(file => ({
        name: file.name,
        path: path.join(servicePath, file.name),
        stats: fs.statSync(path.join(servicePath, file.name))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);
    res.json({
      success: true,
      data: files,
      serviceName: serviceName,
      servicePath: servicePath
    });
  } catch (error) {
    console.error('Error reading log files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read log files',
      details: error.message
    });
  }
});

// API endpoint to get log files for a specific service
router.get('/logs/stream', (req, res) => {
  // Your existing /api/logs/stream logic goes here
  // ...
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Log file not found' });
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  res.write(`data: Connected to ${path.basename(filePath)}\n\n`);
  const tailCommand = `tail -n 10000 -f "${filePath}"`;
  console.log(`Starting log stream: ${tailCommand}`);
  const tail = exec(tailCommand);
  tail.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    });
  });
  tail.stderr.on('data', (data) => {
    console.error(`Tail stderr: ${data}`);
    res.write(`data: ERROR: ${data}\n\n`);
  });
  tail.on('exit', (code) => {
    console.log(`Tail process exited with code: ${code}`);
    res.write(`data: [Process exited with code ${code}]\n\n`);
    res.end();
  });
  req.on('close', () => {
    console.log('Client disconnected, killing tail process');
    tail.kill('SIGTERM');
    res.end();
  });
  req.on('error', (err) => {
    console.error('Stream request error:', err);
    tail.kill('SIGTERM');
    res.end();
  });
});

module.exports = router;