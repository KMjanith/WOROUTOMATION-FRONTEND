const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Function to parse .conf files
function parseConfFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const items = [];
    let currentKey = null;
    let inMultiLineList = false;
    let inObject = false;
    let inOverridesBlock = false;
    let listItems = [];
    let objectLines = [];
    let objectBraceCount = 0;
    let objectIsCommented = false;
    let overridesBraceCount = 0;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Handle multi-line list continuation
      if (inMultiLineList) {
        if (trimmedLine === ']') {
          // End of multi-line list
          items.push({ key: currentKey, value: listItems });
          inMultiLineList = false;
          currentKey = null;
          listItems = [];
        } else if (trimmedLine !== '') {
          // Handle list items (both commented and uncommented)
          let item = trimmedLine;

          // Remove trailing comma if present
          if (item.endsWith(',')) {
            item = item.slice(0, -1).trim();
          }

          // Preserve the item as is (including # if it's commented)
          if (item) {
            listItems.push(item);
          }
        }
        return;
      }

      // Handle object parsing inside overrides block
      if (inObject && inOverridesBlock) {
        objectLines.push(line); // Keep original line with indentation

        // Count braces to handle nested objects
        const openBraces = (trimmedLine.match(/\{/g) || []).length;
        const closeBraces = (trimmedLine.match(/\}/g) || []).length;
        objectBraceCount += openBraces - closeBraces;

        if (objectBraceCount === 0 && trimmedLine.includes('}')) {
          // End of object - store the entire object as one item
          inObject = false;
          const objectValue = objectLines.join('\n');
          items.push({
            key: currentKey,
            value: objectValue,
            isObject: true,
            commented: objectIsCommented
          });
          currentKey = null;
          objectLines = [];
          objectIsCommented = false;
        }
        return;
      }

      // Skip empty lines
      if (!trimmedLine) {
        return;
      }

      // Check for overrides block start/end
      if (!inOverridesBlock && trimmedLine.match(/^overrides\s*\{/)) {
        inOverridesBlock = true;
        overridesBraceCount = 1;
        return;
      }

      if (inOverridesBlock) {
        // Count braces for overrides block
        const openBraces = (trimmedLine.match(/\{/g) || []).length;
        const closeBraces = (trimmedLine.match(/\}/g) || []).length;
        overridesBraceCount += openBraces - closeBraces;

        // If we're at the end of overrides block, stop processing
        if (overridesBraceCount === 0 && trimmedLine === '}') {
          inOverridesBlock = false;
          return;
        }

        // Process content inside overrides block
        const equalIndex = trimmedLine.indexOf('=');

        // Look for object pattern: key { or #key { (inside overrides block)
        const objectMatch = trimmedLine.match(/^(#?)(\s*)([^=\s]+)\s*\{/);
        if (objectMatch) {
          // This is the start of an object inside overrides
          const [, commentPrefix, , objectKey] = objectMatch;
          inObject = true;
          currentKey = objectKey;
          objectLines = [line]; // Start with the current line
          objectBraceCount = 1;
          objectIsCommented = commentPrefix === '#';

          // Check if it's a single-line object
          if (trimmedLine.includes('}')) {
            const openBraces = (trimmedLine.match(/\{/g) || []).length;
            const closeBraces = (trimmedLine.match(/\}/g) || []).length;
            objectBraceCount = openBraces - closeBraces;

            if (objectBraceCount === 0) {
              // Complete single-line object
              inObject = false;
              items.push({
                key: currentKey,
                value: line,
                isObject: true,
                commented: objectIsCommented
              });
              currentKey = null;
              objectLines = [];
              objectIsCommented = false;
            }
          }
          return;
        }

        // Handle regular key=value pairs inside overrides block
        if (equalIndex > 0) {
          let key, value;
          let commented = false;

          // Check if line is commented
          if (trimmedLine.startsWith('#')) {
            commented = true;
            // Remove the # and parse the key=value
            const cleanLine = trimmedLine.substring(1).trim();
            const cleanEqualIndex = cleanLine.indexOf('=');
            if (cleanEqualIndex > 0) {
              key = cleanLine.substring(0, cleanEqualIndex).trim();
              value = cleanLine.substring(cleanEqualIndex + 1).trim();
            }
          } else {
            // Regular uncommented line
            key = trimmedLine.substring(0, equalIndex).trim();
            value = trimmedLine.substring(equalIndex + 1).trim();
          }

          if (key && value !== undefined) {
            // Handle different list formats
            if (value === '[') {
              // Start of multi-line list
              inMultiLineList = true;
              currentKey = key;
              listItems = [];
            } else if (value.startsWith('[') && value.endsWith(']')) {
              // Single-line list
              const listContent = value.slice(1, -1).trim();
              if (listContent === '') {
                value = [];
              } else {
                value = listContent.split(',').map(item => item.trim()).filter(item => item !== '');
              }
              items.push({ key, value, commented });
            } else {
              // Regular key-value pair
              items.push({ key, value, commented });
            }
          }
        }
      } else {
        // Handle items outside overrides block (if any) - for deployment.conf etc.
        const equalIndex = trimmedLine.indexOf('=');

        // Look for object pattern: key { or #key {
        const objectMatch = trimmedLine.match(/^(#?)(\s*)([^=\s]+)\s*\{/);
        if (objectMatch) {
          // This is the start of an object
          const [, commentPrefix, , objectKey] = objectMatch;
          inObject = true;
          currentKey = objectKey;
          objectLines = [line]; // Start with the current line
          objectBraceCount = 1;
          objectIsCommented = commentPrefix === '#';

          // Check if it's a single-line object
          if (trimmedLine.includes('}')) {
            const openBraces = (trimmedLine.match(/\{/g) || []).length;
            const closeBraces = (trimmedLine.match(/\}/g) || []).length;
            objectBraceCount = openBraces - closeBraces;

            if (objectBraceCount === 0) {
              // Complete single-line object
              inObject = false;
              items.push({
                key: currentKey,
                value: line,
                isObject: true,
                commented: objectIsCommented
              });
              currentKey = null;
              objectLines = [];
              objectIsCommented = false;
            }
          }
          return;
        }

        // Handle regular key=value pairs
        if (equalIndex > 0) {
          let key, value;
          let commented = false;

          // Check if line is commented
          if (trimmedLine.startsWith('#')) {
            commented = true;
            // Remove the # and parse the key=value
            const cleanLine = trimmedLine.substring(1).trim();
            const cleanEqualIndex = cleanLine.indexOf('=');
            if (cleanEqualIndex > 0) {
              key = cleanLine.substring(0, cleanEqualIndex).trim();
              value = cleanLine.substring(cleanEqualIndex + 1).trim();
            }
          } else {
            // Regular uncommented line
            key = trimmedLine.substring(0, equalIndex).trim();
            value = trimmedLine.substring(equalIndex + 1).trim();
          }

          if (key && value !== undefined) {
            // Handle different list formats
            if (value === '[') {
              // Start of multi-line list
              inMultiLineList = true;
              currentKey = key;
              listItems = [];
            } else if (value.startsWith('[') && value.endsWith(']')) {
              // Single-line list
              const listContent = value.slice(1, -1).trim();
              if (listContent === '') {
                value = [];
              } else {
                value = listContent.split(',').map(item => item.trim()).filter(item => item !== '');
              }
              items.push({ key, value, commented });
            } else {
              // Regular key-value pair
              items.push({ key, value, commented });
            }
          }
        }
      }
    });

    // Handle case where file ends while in multi-line list or object
    if (inMultiLineList && currentKey) {
      items.push({ key: currentKey, value: listItems });
    }
    if (inObject && currentKey) {
      const objectValue = objectLines.join('\n');
      items.push({
        key: currentKey,
        value: objectValue,
        isObject: true,
        commented: objectIsCommented
      });
    }

    return items;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// API endpoint to get configuration files
// API endpoint to get configuration files
app.get('/api/config', (req, res) => {
  try {
    const homeDir = os.homedir();
    const recipeDir = path.join(homeDir, '.recipe');

    console.log(`Looking for config files in: ${recipeDir}`);

    // Check if .recipe directory exists
    if (!fs.existsSync(recipeDir)) {
      return res.status(404).json({
        error: 'Recipe directory not found',
        path: recipeDir
      });
    }

    const configFiles = ['deployment.conf', 'overrides.conf'];
    const configData = [];

    configFiles.forEach(fileName => {
      const filePath = path.join(recipeDir, fileName);
      const items = parseConfFile(filePath);

      if (items !== null) {
        configData.push({
          fileName,
          items,
          path: filePath
        });
      } else {
        configData.push({
          fileName,
          items: [],
          error: 'File not found or could not be read',
          path: filePath
        });
      }
    });

    res.json({
      success: true,
      data: configData,
      directory: recipeDir
    });

  } catch (error) {
    console.error('Error reading config files:', error);
    res.status(500).json({
      error: 'Failed to read configuration files',
      details: error.message
    });
  }
});

// API endpoint to save configuration file
app.post('/api/config/save', (req, res) => {
  try {
    const { fileName, items } = req.body;

    if (!fileName || !items) {
      return res.status(400).json({
        error: 'Missing required fields: fileName and items'
      });
    }

    const homeDir = os.homedir();
    const recipeDir = path.join(homeDir, '.recipe');
    const filePath = path.join(recipeDir, fileName);

    // Convert items back to file format
    let fileContent = '';

    // Check if this is overrides.conf which needs special formatting
    if (fileName === 'overrides.conf') {
      fileContent = 'overrides {\n';

      items.forEach(item => {
        if (item.isObject) {
          // Handle object blocks - preserve the original formatting
          let objectContent = item.value;

          // If it's commented, add # at the beginning of the first line
          if (item.commented) {
            const lines = objectContent.split('\n');
            if (lines.length > 0) {
              lines[0] = '#' + lines[0];
              objectContent = lines.join('\n');
            }
          } else {
            // If it's uncommented, remove # from the beginning if present
            const lines = objectContent.split('\n');
            if (lines.length > 0 && lines[0].trim().startsWith('#')) {
              lines[0] = lines[0].replace(/^(\s*)#/, '$1');
              objectContent = lines.join('\n');
            }
          }

          fileContent += objectContent + '\n';
        } else if (Array.isArray(item.value)) {
          // Handle list items (if any in overrides)
          fileContent += `${item.key} = [\n`;
          item.value.forEach(listItem => {
            fileContent += `    ${listItem},\n`;
          });
          fileContent += ']\n';
        } else {
          // Handle regular key-value pairs
          const prefix = item.commented ? '#' : '';
          fileContent += `${prefix}${item.key} = ${item.value}\n`;
        }
      });

      fileContent += '}\n';
    } else {
      // Handle other files (like deployment.conf)
      items.forEach(item => {
        if (item.isObject) {
          // Handle object blocks
          fileContent += item.value + '\n';
        } else if (Array.isArray(item.value)) {
          // Handle list items (like deployment.services)
          fileContent += `${item.key} = [\n\n`;
          item.value.forEach(listItem => {
            fileContent += `    ${listItem},\n`;
          });
          fileContent += '\n]\n\n';
        } else {
          // Handle regular key-value pairs
          const prefix = item.commented ? '#' : '';
          fileContent += `${prefix}${item.key} = ${item.value}\n`;
        }
      });
    }

    // Write to file
    fs.writeFileSync(filePath, fileContent, 'utf8');

    console.log(`Successfully saved ${fileName}`);
    res.json({
      success: true,
      message: `Configuration saved to ${fileName}`
    });

  } catch (error) {
    console.error('Error saving config file:', error);
    res.status(500).json({
      error: 'Failed to save configuration file',
      details: error.message
    });
  }
});

// API endpoint to get Docker containers
app.get('/api/docker/containers', (req, res) => {
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
      // Parse the docker ps output
      const lines = stdout.trim().split('\n');

      if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
        // No output
        return res.json({
          success: true,
          data: []
        });
      }

      // Parse container data (no header line since we removed "table" from format)
      const containers = lines.map(line => {
        const parts = line.split('\t');

        // Parse ports to extract only the port mappings
        let ports = parts[4] || '';
        if (ports) {
          // Extract port mappings in format hostPort->containerPort/protocol
          const portMappings = [];
          const debugPorts = [];

          // Match patterns like "0.0.0.0:20295->5000/tcp" or "[::]:20295->5000/tcp"
          const portRegex = /(?:0\.0\.0\.0:|localhost:|\[::\]:)(\d+)->(\d+)\/(\w+)/g;
          let match;

          while ((match = portRegex.exec(ports)) !== null) {
            const hostPort = match[1];
            const containerPort = match[2];
            const protocol = match[3];
            let mapping = `${hostPort}->${containerPort}/${protocol}`;

            // Apply color styling based on container port
            if (containerPort === '7000') {
              // Debug port - red and bold
              mapping = `<span style="color: red; font-weight: bold;">${mapping}</span>`;
              debugPorts.push(mapping);
            } else if (containerPort === '5432') {
              // Database port - orange and bold
              mapping = `<span style="color: orange; font-weight: bold;">${mapping}</span>`;
              portMappings.push(mapping);
            } else {
              portMappings.push(mapping);
            }
          }

          // Combine regular ports first, then debug ports at the end
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HUMMINGBIRD backend is running' });
});

// API endpoint to get log directories
app.get('/api/logs/directories', (req, res) => {
  try {
    const logBasePath = '/home/kavindu-janith/po/var/log/services';

    // Check if the logs directory exists
    if (!fs.existsSync(logBasePath)) {
      return res.status(404).json({
        success: false,
        error: 'Log services directory not found',
        path: logBasePath
      });
    }

    // Read the directory contents
    const items = fs.readdirSync(logBasePath, { withFileTypes: true });

    // Filter only directories
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
app.get('/api/logs/files/:serviceName', (req, res) => {
  try {
    const serviceName = req.params.serviceName;
    const servicePath = path.join('/home/kavindu-janith/po/var/log/services', serviceName);

    // Validate service name (prevent directory traversal)
    if (serviceName.includes('..') || serviceName.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service name'
      });
    }

    // Check if the service directory exists
    if (!fs.existsSync(servicePath)) {
      return res.status(404).json({
        success: false,
        error: 'Service directory not found',
        path: servicePath
      });
    }

    // Read the directory contents
    const items = fs.readdirSync(servicePath, { withFileTypes: true });

    // Filter only files (typically log files)
    const files = items
      .filter(item => item.isFile())
      .map(file => ({
        name: file.name,
        path: path.join(servicePath, file.name),
        stats: fs.statSync(path.join(servicePath, file.name))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime); // Sort by modification time (newest first)

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

// Add this endpoint to your existing server.js file

app.get('/api/logs/stream', (req, res) => {
  const filePath = req.query.path;
  
  // Validate file path
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Log file not found' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: Connected to ${path.basename(filePath)}\n\n`);

  // Execute tail command
  const tailCommand = `tail -n 10000 -f "${filePath}"`;
  console.log(`Starting log stream: ${tailCommand}`);
  
  const tail = exec(tailCommand);

  // Handle stdout data
  tail.stdout.on('data', (data) => {
    // Split data by lines and send each line as separate event
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    });
  });

  // Handle stderr data
  tail.stderr.on('data', (data) => {
    console.error(`Tail stderr: ${data}`);
    res.write(`data: ERROR: ${data}\n\n`);
  });

  // Handle process exit
  tail.on('exit', (code) => {
    console.log(`Tail process exited with code: ${code}`);
    res.write(`data: [Process exited with code ${code}]\n\n`);
    res.end();
  });

  // Handle client disconnect
  req.on('close', () => {
    console.log('Client disconnected, killing tail process');
    tail.kill('SIGTERM');
    res.end();
  });

  // Handle server errors
  req.on('error', (err) => {
    console.error('Stream request error:', err);
    tail.kill('SIGTERM');
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`HUMMINGBIRD backend server running on http://localhost:${PORT}`);
  console.log(`Reading config files from: ${path.join(os.homedir(), '.recipe')}`);
});
