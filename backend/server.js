const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    let currentValue = null;
    let inMultiLineList = false;
    let listItems = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Handle comments and empty lines differently in lists vs regular parsing
      if (inMultiLineList) {
        // In multi-line lists, we want to preserve comments as list items
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
      
      // Skip empty lines and comments for regular key-value pairs
      if (!trimmedLine || (trimmedLine.startsWith('#') && !inMultiLineList) || trimmedLine.startsWith(';')) {
        return;
      }
      
      // Look for key=value pairs
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();
        
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
          items.push({ key, value });
        } else {
          // Regular key-value pair
          items.push({ key, value });
        }
      }
    });
    
    // Handle case where file ends while in multi-line list
    if (inMultiLineList && currentKey) {
      items.push({ key: currentKey, value: listItems });
    }
    
    return items;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

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
    
    items.forEach(item => {
      if (Array.isArray(item.value)) {
        // Handle list items (like deployment.services)
        fileContent += `${item.key} = [\n\n`;
        item.value.forEach(listItem => {
          fileContent += `    ${listItem},\n`;
        });
        fileContent += '\n]\n\n';
      } else {
        // Handle regular key-value pairs
        fileContent += `${item.key} = ${item.value}\n`;
      }
    });
    
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HUMMINGBIRD backend is running' });
});

app.listen(PORT, () => {
  console.log(`HUMMINGBIRD backend server running on http://localhost:${PORT}`);
  console.log(`Reading config files from: ${path.join(os.homedir(), '.recipe')}`);
});
