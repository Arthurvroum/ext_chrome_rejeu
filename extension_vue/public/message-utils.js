/**
 * Message utilities for Chrome extension
 * Provides safe messaging and data transfer capabilities
 */

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
function safelySendTabMessage(tabId, message, callback = null) {
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

// Export utilities
const messageUtils = {
  safelySendMessage,
  safelySendTabMessage,
  transferDataBetweenTabs
};

// Make available in the appropriate context
if (typeof self !== 'undefined') {
  self.messageUtils = messageUtils;
} else if (typeof window !== 'undefined') {
  window.messageUtils = messageUtils;
}
