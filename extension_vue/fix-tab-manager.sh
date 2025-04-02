#!/bin/bash

echo "Ensuring tab manager file consistency..."

# Make sure tab-manager.js exists
if [ ! -f "public/tab-manager.js" ] && [ -f "public/window-manager.js" ]; then
  echo "Renaming window-manager.js to tab-manager.js for consistency"
  cp public/window-manager.js public/tab-manager.js
fi

echo "Done! Tab manager file is now consistent."
