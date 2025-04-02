/**
 * Debugging tools for Chrome Extension
 * 
 * Include this in background.js temporarily for debugging
 */

// Detailed logging function
function debugLog(component, level, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${component}] [${level}]`;
  
  if (data !== undefined) {
    console[level](`${prefix} ${message}`, data);
  } else {
    console[level](`${prefix} ${message}`);
  }
}

// Specifically log background script events
function backgroundLog(level, message, data) {
  debugLog('Background', level, message, data);
}

// Add these to background.js for debugging
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    backgroundLog('debug', `Request initiated: ${details.method} ${details.url}`);
  },
  { urls: ["<all_urls>"] }
);

// Log extension startup
backgroundLog('info', 'Background script started');

// Add listener for errors
chrome.runtime.onInstalled.addListener(() => {
  backgroundLog('info', 'Extension installed/updated');
});

// Log all messages for debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  backgroundLog('debug', 'Message received', message);
  
  // Continue normal processing
  return false;
});
