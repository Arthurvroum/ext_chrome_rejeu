#!/bin/bash

echo "Fixing manifest.json for Chrome Extension Manifest V3..."

MANIFEST_FILE="dist/manifest.json"

# Check if manifest file exists
if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Error: $MANIFEST_FILE not found. Run build first."
  exit 1
fi

# Ensure the manifest file is properly formatted
echo "Ensuring proper manifest.json format..."

# Remove any "type": "module" from background section if it exists
sed -i '/"service_worker"/,/}/ s/"type": "module",*//' "$MANIFEST_FILE"

# Ensure correct manifest version
sed -i 's/"manifest_version": 2,/"manifest_version": 3,/' "$MANIFEST_FILE"

# Fix web_accessible_resources format for MV3 if needed
if grep -q "web_accessible_resources" "$MANIFEST_FILE" && ! grep -q "web_accessible_resources.*resources" "$MANIFEST_FILE"; then
  # Convert v2 format to v3 format
  awk '
  /web_accessible_resources/,/]/ {
    if (/web_accessible_resources/) {
      print "  \"web_accessible_resources\": ["
      print "    {"
      print "      \"resources\": ["
    } 
    else if (/]/) {
      print "      ],"
      print "      \"matches\": [\"<all_urls>\"]"
      print "    }"
      print "  ],"
    }
    else {
      print "        " $0
    }
    next
  }
  { print }
  ' "$MANIFEST_FILE" > "$MANIFEST_FILE.tmp"
  
  mv "$MANIFEST_FILE.tmp" "$MANIFEST_FILE"
fi

# Fix browser_action to action for MV3
sed -i 's/"browser_action"/"action"/' "$MANIFEST_FILE"

# Make sure permissions are properly formatted
if grep -q "declarativeNetRequest" "$MANIFEST_FILE"; then
  echo "Adding host permissions for declarativeNetRequest..."
  if ! grep -q "host_permissions" "$MANIFEST_FILE"; then
    sed -i '/"permissions"/a\  "host_permissions": ["<all_urls>"],' "$MANIFEST_FILE"
  fi
fi

echo "Manifest V3 fixes applied successfully."
chmod +x fix-manifest-v3.sh
