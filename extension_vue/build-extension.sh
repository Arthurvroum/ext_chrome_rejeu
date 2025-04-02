#!/bin/bash

echo "Building Network Request Recorder & Replay Chrome Extension..."

# First run the cleaning script if it exists
if [ -f "./clean-vue-files.sh" ]; then
  ./clean-vue-files.sh
fi

# Then build
echo "Running the build process..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build succeeded!"
    
    # Fix the manifest.json file
    ./fix-manifest.sh
    
    echo "Your extension is now ready in the dist directory."
    echo ""
    echo "To load the extension in Chrome:"
    echo "1. Open Chrome and navigate to chrome://extensions/"
    echo "2. Enable 'Developer mode' (toggle in the top right)"
    echo "3. Click 'Load unpacked' and select the 'dist' folder"
else
    echo "Build failed. Please check the error messages above."
fi

echo "Done."
