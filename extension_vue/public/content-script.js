// Debug logging function
function logDebug(message, data) {
  console.log(`[Content Script] ${message}`, data || '');
}

// State variables
let isObserving = false;
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;

// Announce script is loaded to help with debugging
console.log("[Content Script] Content script has loaded at: " + new Date().toISOString());

// Retry function for sending messages to background script
function sendMessageWithRetry(message, callback = null, attempts = 3) {
  try {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        console.warn(`[Content Script] Message error (${message.action}):`, chrome.runtime.lastError.message);
        
        if (attempts > 1) {
          // Wait a bit longer between each retry
          setTimeout(() => {
            sendMessageWithRetry(message, callback, attempts - 1);
          }, (MAX_RETRIES - attempts + 1) * 200); // Increasing delay for each retry
        } else if (callback) {
          callback({ error: chrome.runtime.lastError.message });
        }
      } else if (callback) {
        callback(response);
      }
    });
  } catch (error) {
    console.error(`[Content Script] Send message failed:`, error);
    if (callback) callback({ error: error.message });
  }
}

// Enhanced connection establishment
function establishConnection() {
  if (isConnected) return;
  
  logDebug('Attempting to establish connection...');
  sendMessageWithRetry({ action: 'checkExtensionStatus' }, response => {
    if (response && !response.error) {
      isConnected = true;
      connectionRetries = 0;
      logDebug('Connection established with background script');
      
      // Now check recording status
      checkRecordingStatus();
    } else {
      // Try to reconnect with exponential backoff
      if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        const delay = Math.min(1000 * Math.pow(2, connectionRetries - 1), 10000);
        logDebug(`Connection failed, retrying in ${delay}ms (attempt ${connectionRetries}/${MAX_RETRIES})`);
        setTimeout(establishConnection, delay);
      } else {
        logDebug('Max connection retries reached. Giving up.');
        connectionRetries = 0; // Reset for future attempts
      }
    }
  });
}

// Check if we should be recording
function checkRecordingStatus() {
  sendMessageWithRetry({ action: 'getRecordingStatus' }, status => {
    if (status && !status.error && status.isRecording && status.activeTabId) {
      // See if we need to start observing immediately
      sendMessageWithRetry({ action: 'getCurrentTabId' }, tabData => {
        if (tabData && !tabData.error && tabData.id === status.activeTabId) {
          startObserving();
        }
      });
    }
  });
}

// Start observing DOM changes
function startObserving() {
  if (isObserving) return;
  
  logDebug('Starting observer');
  try {
    observer.observe(document.body, observerConfig);
    isObserving = true;
    logDebug('Observer started successfully');
  } catch (error) {
    logDebug('Error starting observer:', error.message);
  }
}

// Stop observing DOM changes 
function stopObserving() {
  if (!isObserving) return;
  
  logDebug('Stopping observer');
  observer.disconnect();
  isObserving = false;
  logDebug('Observer stopped successfully');
}

// Listen for DOM changes to capture dynamic content that might contain values
// for variable capture
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' || mutation.type === 'characterData') {
      // Process the changed nodes for variable capture
      checkForVariableCapture(mutation.target);
    }
  }
});

// Configuration for the observer
const observerConfig = {
  attributes: true,
  childList: true,
  characterData: true,
  subtree: true
};

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logDebug('Received message:', message.action);
  
  if (message.action === 'startObserving') {
    startObserving();
    sendResponse({ status: 'Observer started' });
  } 
  else if (message.action === 'stopObserving') {
    stopObserving();
    sendResponse({ status: 'Observer stopped' });
  }
  else if (message.action === 'getObserverStatus') {
    sendResponse({ isObserving, isConnected });
  }
  else if (message.action === 'pingContentScript') {
    // Simple ping to verify content script is alive
    sendResponse({ status: 'Content script is active' });
  }
  else if (message.action === 'executeScript') {
    logDebug('Executing script');
    try {
      // Safely execute script in page context for replay or variable extraction
      const result = eval(message.script);
      sendResponse({ status: 'success', result });
    } catch (error) {
      logDebug('Script execution error:', error.message);
      sendResponse({ status: 'error', error: error.message });
    }
  }
  return true; // Keep messaging channel open for async response
});

// Function to check for variable capture based on regex patterns
function checkForVariableCapture(node) {
  if (!isObserving) return;
  
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    // This would check against configured regex patterns
    // and send captured variables to background script
    logDebug('Processing text node for variables', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  }
  else if (node.nodeType === Node.ELEMENT_NODE) {
    // Check attributes like value, href, etc.
    const url = node.getAttribute('href');
    if (url) {
      logDebug('Processing element with URL', url);
    }
  }
}

// Initialize content script when DOM is fully loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  logDebug('Document already loaded, initializing immediately');
  establishConnection();
} else {
  logDebug('Waiting for document to load before initializing');
  window.addEventListener('DOMContentLoaded', () => {
    logDebug('Document loaded (DOMContentLoaded), initializing content script');
    establishConnection();
  });
  
  window.addEventListener('load', () => {
    logDebug('Document fully loaded (load event), ensuring connection');
    if (!isConnected) {
      establishConnection();
    }
  });
}

// Re-establish connection when the page becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    logDebug('Page became visible, checking connection');
    if (!isConnected) {
      establishConnection();
    }
  }
});

// Force reconnection periodically if not connected
setInterval(() => {
  if (!isConnected) {
    logDebug('Periodic connection check');
    establishConnection();
  }
}, 30000); // Every 30 seconds

logDebug('Content script loaded and initialized');
