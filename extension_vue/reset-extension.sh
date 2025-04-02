#!/bin/bash

echo "Resetting the Chrome extension to a clean state..."

# Remove generated files
echo "Removing dist directory..."
rm -rf dist

# Clean storage data
echo "Creating storage reset script..."
cat > storage-reset.js << 'EOF'
// This script clears extension storage
chrome.storage.local.clear(() => {
  console.log('Extension storage has been cleared');
});
EOF

echo "To completely reset the extension:"
echo "1. Open Chrome's Extensions page (chrome://extensions/)"
echo "2. Remove the extension"
echo "3. Close Chrome completely"
echo "4. Rebuild the extension with: ./build.sh"
echo "5. Load the unpacked extension again from the dist directory"
echo ""
echo "For debugging help, open the background page console:"
echo "1. Go to chrome://extensions/"
echo "2. Find your extension and click on 'service worker' under 'Inspect views'"
echo "3. Use the console to check for errors"

echo "Reset preparation complete!"
