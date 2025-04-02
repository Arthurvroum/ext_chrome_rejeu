const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running Vue.js package recovery...');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('node_modules not found, installing packages...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error installing packages:', error.message);
  }
}

// Check specifically for vue-cli-service
if (!fs.existsSync(path.join('node_modules', '@vue', 'cli-service'))) {
  console.log('@vue/cli-service not found, installing it explicitly...');
  try {
    execSync('npm install @vue/cli-service@~5.0.0 --save-dev', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error installing @vue/cli-service:', error.message);
  }
}

// Create the bin directory if it doesn't exist and link the vue-cli-service
const binDir = path.join('node_modules', '.bin');
if (!fs.existsSync(binDir)) {
  console.log('Creating .bin directory...');
  fs.mkdirSync(binDir, { recursive: true });
}

// Create a local link to vue-cli-service if not exists
const vueCliServicePath = path.join('node_modules', '@vue', 'cli-service', 'bin', 'vue-cli-service.js');
const binLink = path.join(binDir, 'vue-cli-service');

if (fs.existsSync(vueCliServicePath) && !fs.existsSync(binLink)) {
  console.log('Creating vue-cli-service link...');
  try {
    // On Windows, create a .cmd file
    if (process.platform === 'win32') {
      const cmdContent = `@echo off\nnode "%~dp0\\..\\@vue\\cli-service\\bin\\vue-cli-service.js" %*`;
      fs.writeFileSync(`${binLink}.cmd`, cmdContent);
    } else {
      // On Unix, create a symbolic link
      fs.symlinkSync(path.relative(binDir, vueCliServicePath), binLink);
      // Make it executable
      fs.chmodSync(binLink, '755');
    }
  } catch (error) {
    console.error('Error creating link:', error.message);
  }
}

console.log('Recovery completed. Try running "npm run build" now.');
