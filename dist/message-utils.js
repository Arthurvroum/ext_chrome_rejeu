/**
 * Message utilities for Chrome extension
 * Provides safe messaging and data transfer capabilities
 */

// Create a namespace for the message utils
// Ensure it works in both browser and service worker contexts
(function(globalContext) {
  // Default retry settings
  const DEFAULT_RETRIES = 3;
  const DEFAULT_RETRY_DELAY = 300; // ms
  
  // Helper function to safely send messages to tabs with retry mechanism
  function safelySendTabMessage(tabId, message, callback = null, retries = DEFAULT_RETRIES) {
    console.log(`Sending message to tab ${tabId}:`, message);
    
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError.message);
        
        // If we have retries left, try again after a delay
        if (retries > 0) {
          setTimeout(() => {
            safelySendTabMessage(tabId, message, callback, retries - 1);
          }, DEFAULT_RETRY_DELAY);
        } else if (callback) {
          callback({ error: chrome.runtime.lastError.message });
        }
      } else if (callback) {
        callback(response);
      }
    });
  }
  
  // Helper function to check if runtime is available (helps with async messaging)
  function isRuntimeAvailable() {
    return chrome && chrome.runtime && !chrome.runtime.id;
  }
  
  // Helper for safely sending messages with proper error handling
  function safelySendMessage(target, message, callback = null) {
    try {
      if (target === 'runtime') {
        // Send to extension runtime (background)
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            console.warn('Runtime message error:', chrome.runtime.lastError.message);
            if (callback) callback({ error: chrome.runtime.lastError.message });
          } else if (callback) {
            callback(response);
          }
        });
      } else if (typeof target === 'number') {
        // Send to specific tab
        chrome.tabs.sendMessage(target, message, response => {
          if (chrome.runtime.lastError) {
            console.warn(`Tab message error (${target}):`, chrome.runtime.lastError.message);
            if (callback) callback({ error: chrome.runtime.lastError.message });
          } else if (callback) {
            callback(response);
          }
        });
      } else {
        throw new Error('Invalid target type. Use "runtime" or a tab ID number.');
      }
    } catch (error) {
      console.error('Message send error:', error);
      if (callback) callback({ error: error.message });
    }
  }
  
  // Helper for safely sending tab messages with automatic content script checks
  function safelySendTabMessageWithChecks(tabId, message, callback = null) {
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError) {
        console.warn(`Tab get error (${tabId}):`, chrome.runtime.lastError.message);
        if (callback) callback({ error: chrome.runtime.lastError.message });
        return;
      }
      
      // Try to send the message
      safelySendMessage(tabId, message, response => {
        if (response && response.error) {
          // Content script might not be loaded, try to inject it
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-script.js']
          }).then(() => {
            // Try the message again after script is injected
            setTimeout(() => {
              safelySendMessage(tabId, message, callback);
            }, 200);
          }).catch(error => {
            console.error('Script injection error:', error);
            if (callback) callback({ error: error.message });
          });
        } else if (callback) {
          callback(response);
        }
      });
    });
  }
  
  // Send data between tabs via storage
  function transferDataBetweenTabs(data, key, callback = null) {
    chrome.storage.local.set({ [key]: data, [`${key}_timestamp`]: Date.now() }, () => {
      if (chrome.runtime.lastError) {
        console.error('Data transfer error:', chrome.runtime.lastError.message);
        if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
      } else {
        if (callback) callback({ success: true });
      }
    });
  }
  
  // Export functions in a way that works in both browser and service worker contexts
  const messageUtils = {
    safelySendMessage,
    safelySendTabMessage: safelySendTabMessageWithChecks,
    transferDataBetweenTabs,
    isRuntimeAvailable
  };
  
  // Make it available in the global context
  if (typeof globalContext.messageUtils === 'undefined') {
    globalContext.messageUtils = messageUtils;
  }
  
  // Log successful initialization
  console.log('Message utils initialized successfully');
})(typeof self !== 'undefined' ? self : this);
