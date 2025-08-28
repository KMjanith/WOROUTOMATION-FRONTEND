// /backend/routes/dockerRoutes.js
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

// API endpoint to get Docker containers
router.get('/docker/containers', (req, res) => {
  // Your existing /api/docker/containers logic goes here
  // ...
  exec('docker ps --format "{{.ID}}\\t{{.Image}}\\t{{.CreatedAt}}\\t{{.Status}}\\t{{.Ports}}\\t{{.Names}}"', (error, stdout, stderr) => {
    if (error) {
      console.error('Error executing docker ps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to execute docker ps command',
        details: error.message
      });
    }
    if (stderr) {
      console.error('Docker ps stderr:', stderr);
      return res.status(500).json({
        success: false,
        error: 'Docker command error',
        details: stderr
      });
    }
    try {
      const lines = stdout.trim().split('\n');
      if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
        return res.json({
          success: true,
          data: []
        });
      }
      const containers = lines.map(line => {
        const parts = line.split('\t');
        let ports = parts[4] || '';
        if (ports) {
          const portMappings = [];
          const debugPorts = [];
          const portRegex = /(?:0\.0\.0\.0:|localhost:|\[::\]:)(\d+)->(\d+)\/(\w+)/g;
          let match;
          while ((match = portRegex.exec(ports)) !== null) {
            const hostPort = match[1];
            const containerPort = match[2];
            const protocol = match[3];
            let mapping = `${hostPort}->${containerPort}/${protocol}`;
            if (containerPort === '7000') {
              mapping = `<span style="color: red; font-weight: bold;">${mapping}</span>`;
              debugPorts.push(mapping);
            } else if (containerPort === '5432') {
              mapping = `<span style="color: orange; font-weight: bold;">${mapping}</span>`;
              portMappings.push(mapping);
            } else {
              portMappings.push(mapping);
            }
          }
          const allPorts = [...portMappings, ...debugPorts];
          ports = allPorts.join(', ');
        }
        return {
          containerId: parts[0] || '',
          image: parts[1] || '',
          created: parts[2] || '',
          status: parts[3] || '',
          ports: ports,
          names: parts[5] || ''
        };
      });
      res.json({
        success: true,
        data: containers
      });
    } catch (parseError) {
      console.error('Error parsing docker ps output:', parseError);
      res.status(500).json({
        success: false,
        error: 'Failed to parse docker ps output',
        details: parseError.message
      });
    }
  });
});

// DELETE /api/docker/containers/:id
router.delete('/docker/containers/:id', (req, res) => {
  // Your existing DELETE /api/docker/containers/:id logic goes here
  // ...
  const containerId = req.params.id;
  if (!containerId) {
    return res.status(400).json({ success: false, error: 'No container ID provided' });
  }
  exec(`docker rm -f ${containerId}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, error: stderr || error.message });
    }
    return res.json({ success: true, message: `Container ${containerId} deleted` });
  });
});

router.get('/docker/images', (req, res) => {
  // Your existing /api/docker/images logic goes here
  // ...
  exec('docker images --format "{{.Repository}}|{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}"', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, error: stderr || error.message });
    }
    const images = stdout
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const [repository, tag, imageId, created, size] = line.split('|');
        return { repository, tag, imageId, created, size };
      });
    res.json({ success: true, data: images });
  });
});

// DELETE /api/docker/images/dangling
router.delete('/docker/images/dangling', (req, res) => {
  // Your existing /api/docker/images/dangling logic goes here
  // ...
  exec('docker rmi $(docker images -f "dangling=true" -q)', (error, stdout, stderr) => {
    if (error) {
      if (stderr.includes('no such image')) {
        return res.json({
          success: true,
          message: 'No dangling images to delete'
        });
      }
      return res.status(500).json({
        success: false,
        error: stderr || error.message
      });
    }
    const deletedCount = stdout.split('\n').filter(line => line.trim().length > 0).length;
    return res.json({
      success: true,
      message: `Successfully removed ${deletedCount} dangling image${deletedCount !== 1 ? 's' : ''}`,
      stdout
    });
  });
});

module.exports = router;