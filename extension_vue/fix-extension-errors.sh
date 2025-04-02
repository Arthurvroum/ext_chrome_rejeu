#!/bin/bash

echo "Fixing Chrome extension errors..."

# 1. Fix manifest.json - remove type: module from background
if grep -q '"type": "module"' "public/manifest.json"; then
  echo "Removing module type from manifest.json"
  sed -i '/"service_worker"/,/}/ s/"type": "module",*//' public/manifest.json
fi

# 2. Fix background.js - replace window.tabManager with direct function calls
echo "Fixing background.js to use importScripts correctly"
sed -i 's/window.tabManager.openAdvancedTab/openAdvancedTab/g' public/background.js
sed -i 's/window.tabManager.openReplayTab/openReplayTab/g' public/background.js
sed -i 's/window.tabManager.updateReplayProgress/updateReplayProgress/g' public/background.js

# 3. Fix tab-manager.js - remove window exposure
if grep -q "window.tabManager" "public/tab-manager.js"; then
  echo "Removing window.tabManager from tab-manager.js"
  sed -i '/window.tabManager/,/};/d' public/tab-manager.js
  echo "console.log('Tab manager loaded - version 1.2');" >> public/tab-manager.js
fi

# 4. Fix content-script.js - ensure no duplicate isObserving declaration
if grep -q "let isObserving" "public/content-script.js"; then
  OCCURRENCES=$(grep -c "let isObserving" "public/content-script.js")
  if [ "$OCCURRENCES" -gt 1 ]; then
    echo "Fixing duplicate isObserving declarations in content-script.js"
    # Keep only the first occurrence
    sed -i '0,/let isObserving/!s/let isObserving/\/\/ isObserving already declared/' public/content-script.js
  fi
fi

echo "Errors fixed! Rebuild the extension with './build.sh'"
