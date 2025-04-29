# Ark Replayr - Network Request Recorder & Replay

Ark Replayr is a Chrome extension that allows developers to record network requests from web applications and replay them later, making debugging and testing easier.

## Features

- **Record Network Requests**: Capture all network traffic from your web applications
- **Organize Recorded Sessions**: Save and manage multiple recording sessions
- **Replay Requests**: Replay recorded requests individually or as a batch
- **Modify Requests**: Edit request parameters before replay
- **Full-Window Mode**: Expanded interface for detailed analysis
- **Import/Export**: Share recordings between team members

## Installation

### From Source

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/ark-replayr.git
   cd ark-replayr
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the extension:
   ```
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder


## Usage

### Recording Requests

1. Open the extension popup
2. Go to the "Record" tab
3. Click "Start Recording"
4. Interact with your web application to generate network requests
5. Click "Stop Recording" when finished
6. Name and save your recording session

### Replaying Requests

1. Open the extension popup
2. Go to the "Replay" tab
3. Select a saved recording session
4. Click on individual requests to replay them, or use "Replay All"
5. View request and response details

### Advanced Mode

For a larger interface, use the fullscreen mode by clicking the expand button in the top-right corner.

## Development

### Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run serve
   ```

3. For Chrome extension development:
   ```
   npm run watch
   ```
   This will watch for file changes and rebuild the extension

### Build for Production

```
npm run build
```
