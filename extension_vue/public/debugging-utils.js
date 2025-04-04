/**
 * Debugging utilities for Network Request Recorder & Replay extension
 * Use this to diagnose issues with content script communication and more
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
};

// Add timestamp to console logs
function enhanceConsole() {
  ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
    console[method] = function() {
      const args = Array.from(arguments);
      const timestamp = new Date().toISOString();
      originalConsole[method].apply(console, [`[${timestamp}]`, ...args]);
    };
  });
}

// Test content script connectivity
function testContentScript(tabId) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, { action: 'pingContentScript' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Content script not responding: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Check if a URL is restricted
function isRestrictedUrl(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://', 
    'chrome-extension://', 
    'devtools://',
    'chrome-devtools://', 
    'view-source:',
    'about:',
    'file://'
  ];
  
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Test background script connectivity
function testBackgroundScript() {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action: 'ping' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Background script not responding: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Verify that all dependencies are properly loaded in the background script
function checkBackgroundDependencies() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'checkDependencies' }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Error checking dependencies: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

// Perform comprehensive diagnostics
async function runDiagnostics(tabId) {
  const results = {
    timestamp: new Date().toISOString(),
    extension: {
      id: chrome.runtime.id,
      manifest: chrome.runtime.getManifest()
    },
    tests: {}
  };
  
  // Test background connectivity
  try {
    results.tests.backgroundScript = await testBackgroundScript();
  } catch (error) {
    results.tests.backgroundScript = { error: error.message };
  }
  
  // Test content script connectivity if a tab ID is provided
  if (tabId) {
    try {
      results.tests.contentScript = await testContentScript(tabId);
    } catch (error) {
      results.tests.contentScript = { error: error.message };
    }
  }
  
  // Check dependencies
  try {
    results.tests.dependencies = await checkBackgroundDependencies();
  } catch (error) {
    results.tests.dependencies = { error: error.message };
  }
  
  console.log('Diagnostics results:', results);
  return results;
}

// Export the debugging utilities
const debuggingUtils = {
  enhanceConsole,
  testContentScript,
  testBackgroundScript,
  checkBackgroundDependencies,
  runDiagnostics,
  isRestrictedUrl
};

// Make available in the appropriate context
if (typeof self !== 'undefined') {
  self.debuggingUtils = debuggingUtils;
} else if (typeof window !== 'undefined') {
  window.debuggingUtils = debuggingUtils;
}

// Auto-initialize enhanced console
enhanceConsole();
console.log('Debugging utilities loaded');
