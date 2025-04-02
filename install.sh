#!/bin/bash

# Network Request Recorder & Replay Chrome Extension Installation Script

echo "Installing Network Request Recorder & Replay Chrome Extension..."

# Navigate to extension directory
cd "$(dirname "$0")/extension_vue"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the extension
echo "Building extension..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Error: Build failed. Please check the error messages above."
    exit 1
fi

echo ""
echo "Installation completed successfully!"
echo ""
echo "To load the extension in Chrome:"
echo "1. Open Chrome and navigate to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in the top right)"
echo "3. Click 'Load unpacked' and select the 'dist' folder inside the extension_vue directory"
echo ""
echo "Thanks for using Network Request Recorder & Replay!"

exit 0
