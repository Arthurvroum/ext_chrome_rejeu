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

// Inject content script into a tab
function injectContentScript(tabId, callback) {
  console.log(`Attempting to inject content script into tab ${tabId}`);
  
  try {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-script.js']
    })
    .then(() => {
      console.log(`Content script injected successfully into tab ${tabId}`);
      callback(true);
    })
    .catch(error => {
      console.error(`Failed to inject content script into tab ${tabId}:`, error);
      callback(false);
    });
  } catch (error) {
    console.error(`Error during content script injection for tab ${tabId}:`, error);
    callback(false);
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
    ensureContentScript
  };
} else {
  // We're in a regular script
  window.connectionUtils = {
    checkContentScriptAvailable,
    injectContentScript,
    ensureContentScript
  };
}
