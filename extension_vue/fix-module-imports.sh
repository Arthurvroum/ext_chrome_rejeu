#!/bin/bash

echo "Fixing ES Module Imports for Chrome Extension..."

# Update background.js to use ES module imports
BACKGROUND_FILE="public/background.js"
if grep -q "importScripts" "$BACKGROUND_FILE"; then
  echo "Removing importScripts from background.js and adding proper ES module import"
  # Remove importScripts line
  sed -i '/importScripts/d' "$BACKGROUND_FILE"
  
  # Add ES module import at the top of the file (after initial variables)
  sed -i '6i import { openAdvancedTab, openReplayTab, updateReplayProgress } from '\''./tab-manager.js'\'';' "$BACKGROUND_FILE"
  
  echo "Background.js updated successfully with proper ES module imports"
fi

# Ensure tab-manager.js has proper exports
TAB_MANAGER_FILE="public/tab-manager.js"
if [ -f "$TAB_MANAGER_FILE" ]; then
  echo "Checking tab-manager.js for proper ES module exports"
  
  # Check if the file already has exports
  if ! grep -q "export function" "$TAB_MANAGER_FILE"; then
    echo "Adding export keywords to functions in tab-manager.js"
    
    # Add export keyword to functions
    sed -i 's/function openAdvancedTab/export function openAdvancedTab/g' "$TAB_MANAGER_FILE"
    sed -i 's/function openReplayTab/export function openReplayTab/g' "$TAB_MANAGER_FILE"
    sed -i 's/function updateReplayProgress/export function updateReplayProgress/g' "$TAB_MANAGER_FILE"
    
    echo "tab-manager.js updated with export keywords"
  else
    echo "tab-manager.js already has proper exports"
  fi
else
  echo "Warning: tab-manager.js not found. Make sure it exists and has proper ES module exports."
fi

echo "ES Module Imports fix complete."
