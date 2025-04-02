#!/bin/bash

echo "Fixing manifest.json syntax error..."

MANIFEST_FILE="dist/manifest.json"

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: $MANIFEST_FILE does not exist. Run the build first."
    exit 1
fi

# Create a backup of the original manifest
cp "$MANIFEST_FILE" "${MANIFEST_FILE}.bak"

# Fix common syntax errors in the manifest
echo "Checking for syntax errors in manifest.json..."

# Use Python to validate and fix the JSON - with fixed syntax for the regex replacement
python3 -c '
import json
import sys
import re

try:
    with open("'"$MANIFEST_FILE"'", "r") as f:
        content = f.read()
    
    # Fix common issues:
    # 1. Remove trailing commas in objects and arrays
    content = re.sub(r",(\s*[\]}])", r"\1", content)
    
    # 2. Ensure all keys are properly quoted - fixed the replacement string syntax
    lines = content.splitlines()
    fixed_lines = []
    for i, line in enumerate(lines):
        # Look for unquoted keys followed by colon
        line = re.sub(r"([a-zA-Z0-9_]+)(\s*:)", r"\"\1\"\2", line)
        fixed_lines.append(line)
    
    content = "\n".join(fixed_lines)
    
    # Validate the JSON by parsing it
    manifest = json.loads(content)
    
    # Write the fixed JSON back with proper formatting
    with open("'"$MANIFEST_FILE"'", "w") as f:
        json.dump(manifest, f, indent=2)
    
    print("Manifest fixed successfully!")
    sys.exit(0)
except Exception as e:
    print(f"Error: {e}")
    print("Could not automatically fix the manifest. Using direct method.")
    sys.exit(1)
'

# If Python fix fails, create a clean manifest directly
if [ $? -ne 0 ]; then
    echo "Creating a clean manifest.json file..."
    
    # Create a clean manifest with proper JSON syntax
    cat > "$MANIFEST_FILE" << 'EOL'
{
  "name": "Network Request Recorder & Replay",
  "version": "1.0.0",
  "description": "Record and replay HTTP requests with variable capture and substitution",
  "manifest_version": 3,
  "permissions": [
    "webRequest",
    "scripting",
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "index.html",
    "default_title": "Request Recorder & Replay"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"]
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["*.js", "*.html", "index.html", "assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
EOL
    echo "Created a clean manifest.json file with correct syntax."
fi

echo "Done. Try loading the extension again."
chmod +x fix-manifest-json.sh
