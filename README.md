# Network Request Recorder & Replay - Extension Chrome

## Description

Extension Chrome permettant l'enregistrement et le rejeu de requêtes réseau HTTP avec des fonctionnalités avancées de capture et de substitution de variables.

## Key Features

### Recording
- Captures HTTP network requests from the active page
- Intuitive user interface for starting/stopping recording
- Export recordings in standardized format (OpenAPI 3.0)

### Replay
- Dedicated interface for replaying recorded scenarios
- Complete configuration via replay file
- Error handling and execution reports

### Variable Management

#### Capture Variables
- Data capture via regular expressions
- Configuration options:
  - Required/Optional
  - Fail on error
  - Scope (global or per step)

#### Substitution Variables
- Dynamic replacement via regular expressions
- Can be associated with capture variables
- Configurable scope (global or per step)

### Execution Control
- Stop on first error
- Ability to skip specific steps
- Flexible configuration via replay file

### Reports
- Export of execution results
- Generation of formatted PDF reports
- Download of replay data

## Installation for Developers

```bash
# Clone the repository
git clone [repository-url]

# Navigate to the extension directory
cd ext_chrome_rejeu/extension_vue

# Install dependencies
npm install

# Build the extension
npm run build

# Load the extension in Chrome
# 1. Open Chrome and navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select the "dist" folder
```

## Project Structure

```
extension_vue/
├── public/
│   ├── manifest.json       # Extension manifest
│   ├── background.js       # Background service worker
│   ├── content-script.js   # Content script for page interaction
│   └── index.html          # Main HTML file
├── src/
│   ├── App.vue             # Main Vue component
│   ├── main.js             # Entry point
│   └── components/         # Vue components
│       ├── RecordTab.vue   # Recording functionality
│       ├── ReplayTab.vue   # Replay functionality
│       ├── ConfigTab.vue   # Configuration settings
│       └── ReportsTab.vue  # Reports display
```

## Usage

1. **Recording Requests**
   - Open the extension popup
   - Click "Start Recording" to begin capturing requests
   - Navigate through your web application to record interactions
   - Click "Stop Recording" when done
   - Export the recorded scenario as an OpenAPI 3.0 file

2. **Replaying Scenarios**
   - Open the extension popup and navigate to the "Replay" tab
   - Load a previously exported scenario file
   - Configure execution options if needed
   - Start the replay and monitor results
   - Export results or generate PDF reports

3. **Configuration**
   - Configure general settings, URL filtering, and defaults for variables
   - Settings are saved across sessions

4. **Reports**
   - View history of replay executions
   - Filter reports by date, scenario name, or status
   - Generate PDF reports for documentation

## OpenAPI Extensions

The extension uses custom OpenAPI extensions for variable handling:

- `x-variable-capture`: Defines regex patterns to capture values from responses
- `x-variable-substitution`: Defines where and how to substitute variables into requests

## Developer Notes

- All execution options are stored in the replay file for portability
- Use robust error handling when working with the extension
- Ensure compatibility with modern web standards
