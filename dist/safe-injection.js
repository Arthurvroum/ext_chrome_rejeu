/**
 * Safe Content Script Injection Utility
 * This file provides utilities to safely inject and communicate with content scripts
 */

// List of protocols that don't allow content script injection
const RESTRICTED_PROTOCOLS = [
  'chrome://', 
  'chrome-extension://', 
  'devtools://',
  'chrome-devtools://', 
  'view-source:',
  'about:',
  'file://',
  'edge://',
  'brave://'
];

// Check if a URL is restricted
function isRestrictedUrl(url) {
  if (!url) return true;
  
  return RESTRICTED_PROTOCOLS.some(protocol => url.startsWith(protocol));
}

// Check if a URL is injectable (HTTP/HTTPS only for extra safety)
function isInjectableUrl(url) {
  if (!url) return false;
  
  // First check if it's not restricted
  if (isRestrictedUrl(url)) return false;
  
  // Then ensure it's HTTP or HTTPS
  return url.startsWith('http://') || url.startsWith('https://');
}

// Safely inject a content script with proper error handling
function safeInject(tabId, callback) {
  if (!tabId) {
    console.error('Invalid tab ID for injection');
    if (callback) callback({ success: false, error: 'Invalid tab ID' });
    return;
  }

  // Get the tab info first to check URL
  chrome.tabs.get(tabId, tab => {
    // Handle errors getting tab
    if (chrome.runtime.lastError) {
      const errorMsg = `Error accessing tab ${tabId}: ${chrome.runtime.lastError.message}`;
      console.error(errorMsg);
      if (callback) callback({ success: false, error: errorMsg });
      return;
    }
    
    // Check if URL is injectable
    if (!isInjectableUrl(tab.url)) {
      const errorMsg = `Cannot inject into ${tab.url} - restricted or non-HTTP URL`;
      console.warn(errorMsg);
      if (callback) callback({ success: false, error: errorMsg, restricted: true });
      return;
    }
    
    // Proceed with injection
    try {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js']
      })
      .then(() => {
        console.log(`Successfully injected content script into tab ${tabId}`);
        
        // Give a moment for the script to initialize
        setTimeout(() => {
          // Verify the content script is responsive
          try {
            chrome.tabs.sendMessage(tabId, { action: 'pingContentScript' }, response => {
              if (chrome.runtime.lastError) {
                console.warn(`Content script injected but not responding: ${chrome.runtime.lastError.message}`);
                if (callback) callback({ 
                  success: true, 
                  responsive: false,
                  error: 'Content script injected but not responding'
                });
              } else {
                console.log('Content script is responsive:', response);
                if (callback) callback({ success: true, responsive: true });
              }
            });
          } catch (error) {
            console.error('Error pinging content script:', error.message);
            if (callback) callback({ success: true, responsive: false, error: error.message });
          }
        }, 200);
      })
      .catch(error => {
        console.error(`Injection failed for tab ${tabId}:`, error);
        if (callback) callback({ success: false, error: error.message });
      });
    } catch (error) {
      console.error('Error during injection attempt:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });
}

// Safe message sending that handles restricted URLs
function safeSendMessage(tabId, message, callback) {
  if (!tabId) {
    console.error('Invalid tab ID for sending message');
    if (callback) callback({ success: false, error: 'Invalid tab ID' });
    return;
  }

  // Check the tab URL first
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError) {
      const errorMsg = `Error accessing tab ${tabId}: ${chrome.runtime.lastError.message}`;
      console.error(errorMsg);
      if (callback) callback({ success: false, error: errorMsg });
      return;
    }
    
    // Don't even try to send messages to restricted URLs
    if (isRestrictedUrl(tab.url)) {
      const errorMsg = `Cannot send messages to restricted URL: ${tab.url}`;
      console.warn(errorMsg);
      if (callback) callback({ success: false, error: errorMsg, restricted: true });
      return;
    }
    
    // Try to send the message
    try {
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          console.warn(`Error sending message to tab ${tabId}: ${chrome.runtime.lastError.message}`);
          if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
        } else {
          if (callback) callback({ success: true, response });
        }
      });
    } catch (error) {
      console.error('Exception sending message:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });
}

// Export utilities
const safeInjection = {
  isRestrictedUrl,
  isInjectableUrl,
  safeInject,
  safeSendMessage
};

// Make utilities available globally in the appropriate context
if (typeof self !== 'undefined') {
  self.safeInjection = safeInjection;
} else if (typeof window !== 'undefined') {
  window.safeInjection = safeInjection;
}
