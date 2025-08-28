// /backend/utils/confParser.js
const fs = require('fs');
const path = require('path');

function parseConfFile(filePath) {
  // Your existing parseConfFile function logic goes here
  // ...
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
      if (inMultiLineList) {
        if (trimmedLine === ']') {
          items.push({ key: currentKey, value: listItems });
          inMultiLineList = false;
          currentKey = null;
          listItems = [];
        } else if (trimmedLine !== '') {
          let item = trimmedLine;
          if (item.endsWith(',')) {
            item = item.slice(0, -1).trim();
          }
          if (item) {
            listItems.push(item);
          }
        }
        return;
      }
      if (inObject && inOverridesBlock) {
        objectLines.push(line);
        const openBraces = (trimmedLine.match(/\{/g) || []).length;
        const closeBraces = (trimmedLine.match(/\}/g) || []).length;
        objectBraceCount += openBraces - closeBraces;
        if (objectBraceCount === 0 && trimmedLine.includes('}')) {
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
      if (!trimmedLine) {
        return;
      }
      if (!inOverridesBlock && trimmedLine.match(/^overrides\s*\{/)) {
        inOverridesBlock = true;
        overridesBraceCount = 1;
        return;
      }
      if (inOverridesBlock) {
        const openBraces = (trimmedLine.match(/\{/g) || []).length;
        const closeBraces = (trimmedLine.match(/\}/g) || []).length;
        overridesBraceCount += openBraces - closeBraces;
        if (overridesBraceCount === 0 && trimmedLine === '}') {
          inOverridesBlock = false;
          return;
        }
        const equalIndex = trimmedLine.indexOf('=');
        const objectMatch = trimmedLine.match(/^(#?)(\s*)([^=\s]+)\s*\{/);
        if (objectMatch) {
          const [, commentPrefix, , objectKey] = objectMatch;
          inObject = true;
          currentKey = objectKey;
          objectLines = [line];
          objectBraceCount = 1;
          objectIsCommented = commentPrefix === '#';
          if (trimmedLine.includes('}')) {
            const openBraces = (trimmedLine.match(/\{/g) || []).length;
            const closeBraces = (trimmedLine.match(/\}/g) || []).length;
            objectBraceCount = openBraces - closeBraces;
            if (objectBraceCount === 0) {
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
        if (equalIndex > 0) {
          let key, value;
          let commented = false;
          if (trimmedLine.startsWith('#')) {
            commented = true;
            const cleanLine = trimmedLine.substring(1).trim();
            const cleanEqualIndex = cleanLine.indexOf('=');
            if (cleanEqualIndex > 0) {
              key = cleanLine.substring(0, cleanEqualIndex).trim();
              value = cleanLine.substring(cleanEqualIndex + 1).trim();
            }
          } else {
            key = trimmedLine.substring(0, equalIndex).trim();
            value = trimmedLine.substring(equalIndex + 1).trim();
          }
          if (key && value !== undefined) {
            if (value === '[') {
              inMultiLineList = true;
              currentKey = key;
              listItems = [];
            } else if (value.startsWith('[') && value.endsWith(']')) {
              const listContent = value.slice(1, -1).trim();
              if (listContent === '') {
                value = [];
              } else {
                value = listContent.split(',').map(item => item.trim()).filter(item => item !== '');
              }
              items.push({ key, value, commented });
            } else {
              items.push({ key, value, commented });
            }
          }
        }
      } else {
        const equalIndex = trimmedLine.indexOf('=');
        const objectMatch = trimmedLine.match(/^(#?)(\s*)([^=\s]+)\s*\{/);
        if (objectMatch) {
          const [, commentPrefix, , objectKey] = objectMatch;
          inObject = true;
          currentKey = objectKey;
          objectLines = [line];
          objectBraceCount = 1;
          objectIsCommented = commentPrefix === '#';
          if (trimmedLine.includes('}')) {
            const openBraces = (trimmedLine.match(/\{/g) || []).length;
            const closeBraces = (trimmedLine.match(/\}/g) || []).length;
            objectBraceCount = openBraces - closeBraces;
            if (objectBraceCount === 0) {
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
        if (equalIndex > 0) {
          let key, value;
          let commented = false;
          if (trimmedLine.startsWith('#')) {
            commented = true;
            const cleanLine = trimmedLine.substring(1).trim();
            const cleanEqualIndex = cleanLine.indexOf('=');
            if (cleanEqualIndex > 0) {
              key = cleanLine.substring(0, cleanEqualIndex).trim();
              value = cleanLine.substring(cleanEqualIndex + 1).trim();
            }
          } else {
            key = trimmedLine.substring(0, equalIndex).trim();
            value = trimmedLine.substring(equalIndex + 1).trim();
          }
          if (key && value !== undefined) {
            if (value === '[') {
              inMultiLineList = true;
              currentKey = key;
              listItems = [];
            } else if (value.startsWith('[') && value.endsWith(']')) {
              const listContent = value.slice(1, -1).trim();
              if (listContent === '') {
                value = [];
              } else {
                value = listContent.split(',').map(item => item.trim()).filter(item => item !== '');
              }
              items.push({ key, value, commented });
            } else {
              items.push({ key, value, commented });
            }
          }
        }
      }
    });
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

module.exports = {
  parseConfFile,
};