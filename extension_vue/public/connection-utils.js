/**
 * Utility functions to help with robust connection between extension components
 */

// Check if a content script is available in a specific tab
function checkContentScriptAvailable(tabId, callback) {
  try {
    chrome.tabs.sendMessage(
      tabId, 
      { action: 'pingContentScript' }, 
      response => {
        if (chrome.runtime.lastError) {
          console.warn(`Content script not available in tab ${tabId}:`, chrome.runtime.lastError.message);
          callback(false);
        } else if (response) {
          console.log(`Content script available in tab ${tabId}:`, response);
          callback(true);
        } else {
          console.warn(`Content script gave unexpected response in tab ${tabId}`);
          callback(false);
        }
      }
    );
  } catch (error) {
    console.error(`Error checking content script in tab ${tabId}:`, error);
    callback(false);
  }
}

// Check if we can inject into this URL - enhanced with better detection
function canInjectIntoUrl(url) {
  // Don't try to inject into chrome:// URLs and other restricted protocols
  if (!url) {
    console.warn('Empty URL provided to canInjectIntoUrl');
    return false;
  }
  
  const restrictedProtocols = [
    'chrome://', 
    'chrome-extension://', 
    'devtools://',
    'chrome-devtools://', 
    'view-source:',
    'about:',
    'file://'
  ];
  
  for (const protocol of restrictedProtocols) {
    if (url.startsWith(protocol)) {
      console.warn(`URL with restricted protocol detected: ${protocol}`);
      return false;
    }
  }
  
  // Only allow http/https URLs (more restrictive)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.warn(`URL doesn't use HTTP/HTTPS protocol: ${url}`);
    return false;
  }
  
  return true;
}

// Inject content script into a tab with improved error handling
function injectContentScript(tabId, callback) {
  console.log(`Attempting to inject content script into tab ${tabId}`);
  
  // Check if we have permission to access the tab first
  try {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        const errorMsg = `Error getting tab ${tabId} info: ${chrome.runtime.lastError.message}`;
        console.error(errorMsg);
        if (callback) callback(false, errorMsg);
        return;
      }
      
      // Check if we can inject into this URL
      if (!canInjectIntoUrl(tab.url)) {
        const errorMsg = `Cannot inject content script into restricted URL: ${tab.url}`;
        console.warn(errorMsg);
        if (callback) callback(false, errorMsg);
        return;
      }
      
      // Safe to inject
      try {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-script.js']
        })
        .then(() => {
          console.log(`Content script injected successfully into tab ${tabId}`);
          if (callback) callback(true);
        })
        .catch(error => {
          const errorMsg = `Failed to inject content script into tab ${tabId}: ${error.message}`;
          console.error(errorMsg);
          if (callback) callback(false, errorMsg);
        });
      } catch (error) {
        const errorMsg = `Error during content script injection for tab ${tabId}: ${error.message}`;
        console.error(errorMsg);
        if (callback) callback(false, errorMsg);
      }
    });
  } catch (error) {
    const errorMsg = `Exception accessing tab ${tabId}: ${error.message}`;
    console.error(errorMsg);
    if (callback) callback(false, errorMsg);
  }
}

// Ensure a content script is running in a specific tab
function ensureContentScript(tabId, callback, maxRetries = 3) {
  let retries = 0;
  
  function checkAndInject() {
    checkContentScriptAvailable(tabId, isAvailable => {
      if (isAvailable) {
        callback(true);
      } else if (retries < maxRetries) {
        retries++;
        console.log(`Attempting to inject content script (retry ${retries}/${maxRetries})`);
        injectContentScript(tabId, success => {
          if (success) {
            // Give it a moment to initialize
            setTimeout(() => {
              checkContentScriptAvailable(tabId, isNowAvailable => {
                callback(isNowAvailable);
              });
            }, 500);
          } else {
            // If injection failed, try one more time after a delay
            setTimeout(checkAndInject, 1000);
          }
        });
      } else {
        console.error(`Failed to ensure content script in tab ${tabId} after ${maxRetries} attempts`);
        callback(false);
      }
    });
  }
  
  checkAndInject();
}

// Export utility functions for use in other scripts
if (typeof importScripts === 'function') {
  // We're in a background script
  self.connectionUtils = {
    checkContentScriptAvailable,
    injectContentScript,
    ensureContentScript,
    canInjectIntoUrl
  };
} else {
  // We're in a regular script
  window.connectionUtils = {
    checkContentScriptAvailable,
    injectContentScript,
    ensureContentScript,
    canInjectIntoUrl
  };
}
