#!/bin/bash

# Fix script for Vue build issues

echo "Starting Vue.js build troubleshooting..."

# Check node version
echo "Node version:"
node -v

# Check npm version
echo "NPM version:"
npm -v

# Clean node_modules and package-lock.json
echo "Cleaning previous installation..."
rm -rf node_modules
rm -f package-lock.json

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if vue-cli-service exists
if [ ! -f "./node_modules/.bin/vue-cli-service" ]; then
  echo "vue-cli-service not found, installing specifically..."
  npm install @vue/cli-service@~5.0.0 --save-dev
  
  # Run the recovery script for extra reliability
  echo "Running recovery script..."
  node recover.js
fi

# Try building
echo "Attempting to build..."
npx vue-cli-service build

# Check result
if [ $? -eq 0 ]; then
    echo "Build successful! Your extension is ready in the dist directory."
    # Fix the manifest file
    ./fix-manifest.sh
else
    echo "Build failed. Please check the error messages above."
    
    # Additional debug info
    echo "Checking for common issues..."
    
    # Check for import issues in main.js
    echo "Checking main.js..."
    cat src/main.js
    
    # Check Vue version
    echo "Vue version:"
    npm list vue
    
    echo "You may need to:"
    echo "1. Ensure all Vue components start with <template>, <script>, or <style> tags"
    echo "2. Check for proper imports in main.js"
    echo "3. Try installing Vue CLI globally: npm install -g @vue/cli @vue/cli-service"
    echo "4. Run the extension build with: npx vue-cli-service build"
fi

echo "Done."
