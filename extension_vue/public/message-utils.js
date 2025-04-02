/**
 * Utility functions for robust message handling in Chrome extensions
 */

// Safely send message to a tab with retry mechanism
function safelySendTabMessage(tabId, message, callback = null, retries = 3) {
  console.log(`[MessageUtils] Sending message to tab ${tabId}:`, message.action);
  
  try {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) {
        console.warn(`[MessageUtils] Error sending message to tab ${tabId}:`, chrome.runtime.lastError.message);
        
        // If we have retries left, try again after a delay
        if (retries > 0) {
          setTimeout(() => {
            console.log(`[MessageUtils] Retrying message to tab ${tabId} (${retries} retries left)`);
            safelySendTabMessage(tabId, message, callback, retries - 1);
          }, 500);
        } else if (callback) {
          callback({ error: chrome.runtime.lastError.message });
        }
      } else if (callback) {
        callback(response);
      }
    });
  } catch (error) {
    console.error(`[MessageUtils] Exception sending message to tab ${tabId}:`, error);
    if (callback) callback({ error: error.message });
  }
}

// Check if content script is loaded in a tab
function checkContentScriptLoaded(tabId, callback) {
  console.log(`[MessageUtils] Checking if content script is loaded in tab ${tabId}`);
  
  safelySendTabMessage(tabId, { action: 'pingContentScript' }, response => {
    const isLoaded = response && !response.error;
    console.log(`[MessageUtils] Content script in tab ${tabId} is ${isLoaded ? 'loaded' : 'not loaded'}`);
    callback(isLoaded);
  }, 1); // Just one attempt for checking
}

// Ensure content script is loaded, injecting if necessary
function ensureContentScriptLoaded(tabId, callback) {
  checkContentScriptLoaded(tabId, isLoaded => {
    if (isLoaded) {
      callback(true);
      return;
    }
    
    console.log(`[MessageUtils] Injecting content script into tab ${tabId}`);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-script.js']
    }).then(() => {
      console.log(`[MessageUtils] Content script injected into tab ${tabId}`);
      // Wait a moment for the script to initialize
      setTimeout(() => {
        checkContentScriptLoaded(tabId, isNowLoaded => {
          callback(isNowLoaded);
        });
      }, 500);
    }).catch(error => {
      console.error(`[MessageUtils] Failed to inject content script into tab ${tabId}:`, error);
      callback(false);
    });
  });
}

// Export functions
if (typeof importScripts === 'function') {
  // We're in a worker context (background script)
  self.messageUtils = {
    safelySendTabMessage,
    checkContentScriptLoaded,
    ensureContentScriptLoaded
  };
}
