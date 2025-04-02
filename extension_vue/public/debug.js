// Debugging script for chrome extension
// Load this in your background script with importScripts('debug.js')

// Override console methods to add more information
const originalConsole = {};
['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
  originalConsole[method] = console[method];
  console[method] = function() {
    const timestamp = new Date().toISOString();
    const args = Array.from(arguments);
    const prefix = `[${timestamp}] [${method.toUpperCase()}]`;
    originalConsole[method].apply(console, [prefix, ...args]);
  };
});

// Monitor all messages
function monitorMessages() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message intercepted:', message);
    // Let the normal handling continue
  });
}

// Monitor storage changes
function monitorStorage() {
  chrome.storage.onChanged.addListener((changes, area) => {
    console.log(`Storage changes in ${area}:`, changes);
  });
}

// Check extension health
function checkExtensionHealth() {
  console.log('Checking extension health...');
  
  // Check if tab manager is loaded
  if (window.tabManager) {
    console.log('Tab manager is available with methods:', Object.keys(window.tabManager));
  } else {
    console.error('Tab manager is NOT available');
  }
  
  // Check storage
  chrome.storage.local.get(null, (data) => {
    console.log('Current storage state:', data);
  });
}

// Initialize debugging
function initDebug() {
  console.log('Debug module initialized');
  monitorMessages();
  monitorStorage();
  checkExtensionHealth();
}

// Expose debug functions
window.debug = {
  checkHealth: checkExtensionHealth,
  init: initDebug
};

// Auto-initialize
setTimeout(initDebug, 1000);
