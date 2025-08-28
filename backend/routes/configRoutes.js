// /backend/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseConfFile } = require('../utils/confParser');

// API endpoint to get configuration files
router.get('/config', (req, res) => {
  // Your existing /api/config logic goes here
  // ...
  try {
    const homeDir = os.homedir();
    const recipeDir = path.join(homeDir, '.recipe');
    console.log(`Looking for config files in: ${recipeDir}`);
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
router.post('/config/save', (req, res) => {
  // Your existing /api/config/save logic goes here
  // ...
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
    let fileContent = '';
    if (fileName === 'overrides.conf') {
      fileContent = 'overrides {\n';
      items.forEach(item => {
        if (item.isObject) {
          let objectContent = item.value;
          if (item.commented) {
            const lines = objectContent.split('\n');
            if (lines.length > 0) {
              lines[0] = '#' + lines[0];
              objectContent = lines.join('\n');
            }
          } else {
            const lines = objectContent.split('\n');
            if (lines.length > 0 && lines[0].trim().startsWith('#')) {
              lines[0] = lines[0].replace(/^(\s*)#/, '$1');
              objectContent = lines.join('\n');
            }
          }
          fileContent += objectContent + '\n';
        } else if (Array.isArray(item.value)) {
          fileContent += `${item.key} = [\n`;
          item.value.forEach(listItem => {
            fileContent += `    ${listItem},\n`;
          });
          fileContent += ']\n';
        } else {
          const prefix = item.commented ? '#' : '';
          fileContent += `${prefix}${item.key} = ${item.value}\n`;
        }
      });
      fileContent += '}\n';
    } else {
      items.forEach(item => {
        if (item.isObject) {
          fileContent += item.value + '\n';
        } else if (Array.isArray(item.value)) {
          fileContent += `${item.key} = [\n\n`;
          item.value.forEach(listItem => {
            fileContent += `    ${listItem},\n`;
          });
          fileContent += '\n]\n\n';
        } else {
          const prefix = item.commented ? '#' : '';
          fileContent += `${prefix}${item.key} = ${item.value}\n`;
        }
      });
    }
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

module.exports = router;