// Advanced debugging for Chrome extension background script
// Import this at the top of your background.js during development

// Enable detailed debugging
const DEBUG_MODE = true;
const DEBUG_REQUEST_DETAILS = true; // Log details of each request
const DEBUG_NETWORK_FILTER = ['youtube.com', 'googlevideo.com', 'ytimg.com']; // Only log these domains

// Add timestamp to console logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Override console methods to add timestamps
console.log = function() {
  const args = Array.from(arguments);
  const timestamp = new Date().toISOString();
  originalConsoleLog.apply(console, [`[${timestamp}]`, ...args]);
};

console.error = function() {
  const args = Array.from(arguments);
  const timestamp = new Date().toISOString();
  originalConsoleError.apply(console, [`[${timestamp}] [ERROR]`, ...args]);
};

console.warn = function() {
  const args = Array.from(arguments);
  const timestamp = new Date().toISOString();
  originalConsoleWarn.apply(console, [`[${timestamp}] [WARN]`, ...args]);
};

console.info = function() {
  const args = Array.from(arguments);
  const timestamp = new Date().toISOString();
  originalConsoleInfo.apply(console, [`[${timestamp}] [INFO]`, ...args]);
};

// Detailed logging function
function detailedLog(component, level, message, data) {
  if (!DEBUG_MODE) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${component}] [${level}]`;
  
  if (data !== undefined) {
    console[level](`${prefix} ${message}`, data);
  } else {
    console[level](`${prefix} ${message}`);
  }
}

// Create helper functions for different components
function bgLog(level, message, data) {
  detailedLog('Background', level, message, data);
}

// Export these for use in background.js
window.debugTools = {
  detailedLog,
  bgLog
};

// Add listener to monitor extension state and log errors
chrome.runtime.onInstalled.addListener(() => {
  bgLog('info', 'Extension installed/updated');
});

// Debug logger for network requests
if (DEBUG_REQUEST_DETAILS) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      // Only log requests from domains we care about
      if (DEBUG_NETWORK_FILTER.some(domain => details.url.includes(domain))) {
        bgLog('debug', `Network: ${details.method} ${details.url.substring(0, 100)}...`, {
          tabId: details.tabId,
          type: details.type,
          frameId: details.frameId
        });
      }
    },
    { urls: ["<all_urls>"] }
  );
}

// Log any runtime errors that occur in the extension
chrome.runtime.onError.addListener((error) => {
  bgLog('error', 'Runtime error:', error);
});

bgLog('info', 'Debug module loaded');
