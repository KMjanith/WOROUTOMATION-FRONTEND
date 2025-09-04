const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const pty = require('node-pty');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3001;

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Deployment tracking
const deploymentSessions = new Map(); // Store active deployment sessions
const { v4: uuidv4 } = require('uuid'); // For generating deployment IDs

// Function to clean ANSI escape sequences and control characters
function cleanTerminalOutput(text) {
  return text
    // Remove ANSI escape sequences (ESC followed by [ and parameters)
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[?]?[0-9;]*[a-zA-Z]/g, '')
    // Remove specific control sequences like [0J, [2K but NOT [info] or [local-docker]
    .replace(/\[[\d]+[A-Z]/g, '')
    .replace(/\[\d*J/g, '')
    .replace(/\[\d*K/g, '')
    .replace(/\[\d*H/g, '')
    // Remove carriage return and form feed characters
    .replace(/[\r\f]/g, '')
    // Remove NULL characters
    .replace(/\x00/g, '')
    // Split by lines and process each line individually, preserving indentation
    .split('\n')
    .map(line => {
      // Only trim trailing whitespace, preserve leading spaces for indentation
      return line.replace(/\s+$/, '');
    })
    .filter(line => line.length > 0)
    .join('\n')
    .replace(/^\s+/, ''); // Only remove leading whitespace from the very beginning
}

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

// DELETE /api/docker/containers/:id
app.delete('/api/docker/containers/:id', (req, res) => {
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

// DELETE /api/docker/containers/delete-all - Delete all containers
app.delete('/api/docker/containers/delete-all', (req, res) => {
  console.log('Deleting all containers...');

  // First, get the list of all container IDs
  exec('docker ps -aq', async (error, stdout, stderr) => {
    if (error) {
      console.error('Error getting container list:', stderr);
      return res.status(500).json({
        success: false,
        error: stderr || error.message
      });
    }

    const containerIds = stdout.trim().split('\n').filter(id => id.length > 0);
    console.log('Found containers:', containerIds);

    // If no containers exist
    if (containerIds.length === 0) {
      console.log('No containers to delete');
      return res.json({
        success: true,
        message: 'No containers found to delete',
        deletedContainers: []
      });
    }

    console.log(`Attempting to delete ${containerIds.length} containers one by one...`);

    const deletedContainers = [];
    const failedContainers = [];

    // Use a for...of loop to handle each deletion asynchronously
    for (const containerId of containerIds) {
      try {
        await new Promise((resolve, reject) => {
          exec(`docker rm -f ${containerId}`, (deleteError, deleteStdout, deleteStderr) => {
            if (deleteError) {
              console.error(`Error deleting container ${containerId}:`, deleteStderr);
              failedContainers.push({
                id: containerId,
                error: deleteStderr || deleteError.message
              });
              reject(deleteError);
            } else {
              console.log(`Successfully deleted container: ${containerId}`);
              deletedContainers.push(containerId);
              resolve();
            }
          });
        });
      } catch (e) {
        // Continue to the next container even if one fails
        continue;
      }
    }

    // After the loop, send the final response
    if (failedContainers.length > 0) {
      return res.status(500).json({
        success: false,
        message: `Successfully deleted ${deletedContainers.length} containers, but failed to delete ${failedContainers.length} containers`,
        deletedContainers,
        failedContainers
      });
    }

    console.log('Successfully deleted all containers:', deletedContainers);
    return res.json({
      success: true,
      message: `Successfully deleted all ${deletedContainers.length} containers`,
      deletedContainers
    });
  });
});


// POST /api/up-recipe/deploy
app.post('/api/up-recipe/deploy', (req, res) => {
  const recipeDir = '/home/kavindu-janith/platformrecipe';
  const deployCmd = 'sbt --client personal:deploy -y';

  // Compose the shell command
  const fullCmd = `cd "${recipeDir}" && ${deployCmd}`;

  // Run the command
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

// POST /api/terminal/open - Open a real terminal  
app.post('/api/terminal/open', (req, res) => {
  var { path, command } = req.body;
  const { spawn } = require('child_process');

  console.log(command);

  // Define the command to launch the terminal
  const command1 = '/usr/bin/gnome-terminal';

  // The command string from the request body needs to be split into an array of arguments.
  const commandArgs = command.match(/(?:[^\s"]+|"[^"]*")+/g).map(arg => {
    return arg.replace(/^"|"$/g, '');
  });

  // The correct UUID from your dconf output.
  const profileUUID = 'b1dcc9dd-5262-4d8d-a863-c897e6d979b9'; 

  // Construct the final 'args' array, including the profile UUID.
  const args = [
    '--profile',
    profileUUID,
    '--',
    ...commandArgs
  ];
  // --- End of change ---

  // Spawn the process with error handling
  const child = spawn(command1, args, {
    detached: true,
    stdio: 'ignore',
    env: {
      DISPLAY: ':1'
    }
  });

  // Check for the 'error' event
  child.on('error', (err) => {
    console.error('Failed to start a new terminal:', err);
  });

  // Log process information
  console.log(`Attempted to start new terminal. PID: ${child.pid}`);
  console.log('A new GNOME Terminal session has been started!');

  res.json({
    success: true,
    message: `Terminal opened successfully${path ? ` with tail -f for ${path}` : ''}`,
    pid: child.pid
  });
});

// POST /api/deployment/start - Start a new deployment with real-time tracking
app.post('/api/deployment/start', (req, res) => {
  const { command } = req.body;
  const deploymentId = uuidv4();
  const recipeDir = '/home/kavindu-janith/platformrecipe';

  // Default to the personal:deploy command if none provided
  const deployCmd = command || 'personal:deploy -y';
  const fullCmd = `cd "${recipeDir}" && sbt --client ${deployCmd}`;

  console.log(`Starting deployment ${deploymentId} with command: ${fullCmd}`);

  // Create deployment session
  const deploymentSession = {
    id: deploymentId,
    command: deployCmd,
    status: 'running',
    startTime: new Date(),
    clients: new Set(), // WebSocket clients listening to this deployment
    logs: []
  };

  deploymentSessions.set(deploymentId, deploymentSession);

  // Start the deployment process
  const deployProcess = exec(fullCmd, { cwd: recipeDir }, (error, stdout, stderr) => {
    const session = deploymentSessions.get(deploymentId);
    if (session) {
      if (error) {
        session.status = 'failed';
        session.endTime = new Date();
        session.logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Deployment failed: ${stderr || error.message}`
        });

        // Notify all connected clients
        session.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'status',
              status: 'failed'
            }));
            client.send(JSON.stringify({
              type: 'log',
              level: 'error',
              message: `Deployment failed: ${stderr || error.message}`
            }));
          }
        });
      } else {
        session.status = 'completed';
        session.endTime = new Date();
        session.logs.push({
          timestamp: new Date().toISOString(),
          level: 'success',
          message: 'Deployment completed successfully'
        });

        // Notify all connected clients
        session.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'status',
              status: 'completed'
            }));
            client.send(JSON.stringify({
              type: 'log',
              level: 'success',
              message: 'Deployment completed successfully'
            }));
          }
        });
      }
    }
  });

  // Capture real-time output
  deployProcess.stdout.on('data', (data) => {
    const session = deploymentSessions.get(deploymentId);
    if (session) {
      const cleanMessage = cleanTerminalOutput(data.toString());
      if (cleanMessage) {
        // Split by lines and process each line separately
        const lines = cleanMessage.split('\n').filter(line => line.trim().length > 0);
        lines.forEach(line => {
          // Check if the line already contains log level info like [info], [warn], [error]
          const hasLogLevel = /^\s*\[(info|warn|error|debug)\]/i.test(line);
          const logLevel = hasLogLevel ? 'raw' : 'info'; // Use 'raw' for lines that already have level info

          session.logs.push({
            timestamp: new Date().toISOString(),
            level: logLevel,
            message: line
          });

          // Send to all connected clients
          session.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'log',
                level: logLevel,
                message: line
              }));
            }
          });
        });
      }
    }
  });

  deployProcess.stderr.on('data', (data) => {
    const session = deploymentSessions.get(deploymentId);
    if (session) {
      const cleanMessage = cleanTerminalOutput(data.toString());
      if (cleanMessage) {
        // Split by lines and process each line separately
        const lines = cleanMessage.split('\n').filter(line => line.trim().length > 0);
        lines.forEach(line => {
          session.logs.push({
            timestamp: new Date().toISOString(),
            level: 'warning',
            message: line.trim()
          });

          // Send to all connected clients
          session.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'log',
                level: 'warning',
                message: line.trim()
              }));
            }
          });
        });
      }
    }
  });

  res.json({
    success: true,
    deploymentId: deploymentId,
    message: 'Deployment started successfully'
  });
});

// GET /api/deployment/:id/status - Get deployment status
app.get('/api/deployment/:id/status', (req, res) => {
  const { id } = req.params;
  const session = deploymentSessions.get(id);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Deployment not found'
    });
  }

  res.json({
    success: true,
    deployment: {
      id: session.id,
      command: session.command,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      logs: session.logs
    }
  });
});

app.get('/api/docker/images', (req, res) => {
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

// DELETE /api/docker/images/:id - Delete a specific image
app.delete('/api/docker/images/:id', (req, res) => {
  const imageId = req.params.id;
  if (!imageId) {
    return res.status(400).json({ success: false, error: 'No image ID provided' });
  }

  // First, get the image details to include repository and tag in success message
  exec('docker images --format "{{.Repository}}|{{.Tag}}|{{.ID}}"', (infoError, infoStdout, infoStderr) => {
    let imageInfo = null;
    
    console.log('Looking for image info for ID:', imageId);
    
    if (!infoError && infoStdout) {
      // Find the image that matches our ID
      const lines = infoStdout.trim().split('\n');
      console.log('Available images:', lines);
      
      for (const line of lines) {
        const [repository, tag, shortId] = line.split('|');
        console.log(`Checking: ${repository}:${tag} with ID ${shortId} against ${imageId}`);
        
        // Match both ways: short ID vs provided ID
        if (shortId === imageId || imageId.startsWith(shortId) || shortId.startsWith(imageId)) {
          imageInfo = { repository, tag, id: imageId };
          console.log('Found matching image:', imageInfo);
          break;
        }
      }
    }

    // Now delete the image
    exec(`docker rmi -f ${imageId}`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ success: false, error: stderr || error.message });
      }
      
      // Create a more informative success message
      let message;
      if (imageInfo) {
        if (imageInfo.repository === '<none>' && imageInfo.tag === '<none>') {
          message = `Image ${imageId} (dangling image) deleted`;
        } else if (imageInfo.repository === '<none>') {
          message = `Image ${imageId} (tag: <strong>${imageInfo.tag}</strong>) deleted`;
        } else if (imageInfo.tag === '<none>') {
          message = `Image ${imageId} (${imageInfo.repository}) deleted`;
        } else {
          message = `Image ${imageInfo.repository}:<strong>${imageInfo.tag}</strong> (${imageId}) deleted`;
        }
      } else {
        message = `Image ${imageId} deleted`;
      }
      
      console.log('Delete success message:', message);
      return res.json({ success: true, message });
    });
  });
});

// DELETE /api/docker/images/dangling
app.delete('/api/docker/images/dangling', (req, res) => {
  exec('docker rmi $(docker images -f "dangling=true" -q)', (error, stdout, stderr) => {
    if (error) {
      // If there are no dangling images, Docker returns an error but that's not a real error
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

    // Count the number of deleted images
    const deletedCount = stdout.split('\n').filter(line => line.trim().length > 0).length;

    return res.json({
      success: true,
      message: `Successfully removed ${deletedCount} dangling image${deletedCount !== 1 ? 's' : ''}`,
      stdout
    });
  });
});


// Create HTTP server from the Express app
const server = http.createServer(app);

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ noServer: true });
const deploymentWss = new WebSocket.Server({ noServer: true });

// Handle deployment WebSocket connections
deploymentWss.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const deploymentId = url.pathname.split('/').pop(); // Extract deployment ID from URL

  console.log(`Deployment WebSocket connection established for deployment: ${deploymentId}`);

  const session = deploymentSessions.get(deploymentId);
  if (!session) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Deployment not found'
    }));
    ws.close();
    return;
  }

  // Add client to session
  session.clients.add(ws);

  // Send current status and existing logs
  ws.send(JSON.stringify({
    type: 'status',
    status: session.status
  }));

  // Send existing logs
  session.logs.forEach(log => {
    ws.send(JSON.stringify({
      type: 'log',
      level: log.level,
      message: log.message,
      timestamp: log.timestamp
    }));
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Deployment WebSocket connection closed for deployment: ${deploymentId}`);
    if (session) {
      session.clients.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error(`Deployment WebSocket error for deployment ${deploymentId}:`, error);
    if (session) {
      session.clients.delete(ws);
    }
  });
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Terminal WebSocket connection established');

  // Determine which shell to use based on platform
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'; // Use powershell on windows for better experience
  const args = [];

  // Set up pseudo-terminal using node-pty
  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-color',
    cols: 80, // Default columns
    rows: 24,  // Default rows
    cwd: os.homedir(), // Start in the user's home directory
    env: process.env
  });

  // Send terminal output to client
  ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data); // `node-pty` data is already a string
    }
  });

  // Handle client input and pipe it to the terminal process
  ws.on('message', (message) => {
    try {
      ptyProcess.write(message.toString());
    } catch (error) {
      console.error('Error writing to terminal process:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Terminal WebSocket connection closed');
    ptyProcess.kill();
  });

  // Handle terminal process exit
  ptyProcess.on('exit', (code) => {
    console.log(`Terminal process exited with code ${code}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`\r\nProcess exited with code ${code}\r\n`);
      ws.close();
    }
  });
});

// Handle HTTP upgrade requests and route them to the WebSocket server
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname.startsWith('/ws/deployment/')) {
    deploymentWss.handleUpgrade(request, socket, head, (ws) => {
      deploymentWss.emit('connection', ws, request);
    });
  } else {
    // Destroy the socket if the path doesn't match
    socket.destroy();
  }
});

// Start the combined HTTP and WebSocket server
server.listen(PORT, () => {
  console.log(`HUMMINGBIRD backend server running on http://localhost:${PORT}`);
  console.log(`WebSocket terminal server is available at ws://localhost:${PORT}/terminal`);
  console.log(`WebSocket deployment server is available at ws://localhost:${PORT}/ws/deployment/{deploymentId}`);
});