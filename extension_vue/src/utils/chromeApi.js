/**
 * Utilities for interacting with Chrome extension APIs
 */

/**
 * Send a message to the background script
 * @param {Object} message - The message to send
 * @returns {Promise} - Promise that resolves with the response
 */
export function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      reject(error);
    }
  });
}

/**
 * Send a message to a content script in a specific tab
 * @param {number} tabId - The ID of the tab
 * @param {Object} message - The message to send
 * @returns {Promise} - Promise that resolves with the response
 */
export function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Tab message error:', chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('Error sending message to tab:', error);
      reject(error);
    }
  });
}

/**
 * Get the active tab in the current window
 * @returns {Promise} - Promise that resolves with the active tab
 */
export function getActiveTab() {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (tabs && tabs.length > 0) {
          resolve(tabs[0]);
        } else {
          reject(new Error('No active tab found'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if a URL is restricted (e.g., chrome://, extension pages)
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is restricted
 */
export function isRestrictedUrl(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://', 
    'chrome-extension://', 
    'devtools://',
    'chrome-devtools://',
    'edge://',
    'brave://',
    'view-source:',
    'about:',
    'file://',
    'data:',
    'javascript:'
  ];
  
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * Inject content script into a tab
 * @param {number} tabId - The ID of the tab
 * @returns {Promise} - Promise that resolves when script is injected
 */
export function injectContentScript(tabId) {
  return new Promise(async (resolve, reject) => {
    try {
      // First check if tab is valid
      const tab = await chrome.tabs.get(tabId);
      
      // Skip injecting into restricted URLs
      if (isRestrictedUrl(tab.url)) {
        reject(new Error(`Cannot inject content script into restricted URL: ${tab.url}`));
        return;
      }
      
      // Only inject on http/https URLs
      if (tab.url.startsWith('http')) {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-script.js']
        });
        resolve(result);
      } else {
        reject(new Error(`Cannot inject content script into URL: ${tab.url}`));
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if content script is ready in a tab
 * @param {number} tabId - The ID of the tab
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} - Promise that resolves with true if ready, false otherwise
 */
export function checkContentScriptReady(tabId, timeout = 1000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    function check() {
      try {
        sendMessageToTab(tabId, { action: 'pingContentScript' })
          .then(response => {
            console.log('Content script is ready:', response);
            resolve(true);
          })
          .catch(() => {
            if (Date.now() - startTime < timeout) {
              setTimeout(check, 100);
            } else {
              resolve(false);
            }
          });
      } catch (error) {
        if (Date.now() - startTime < timeout) {
          setTimeout(check, 100);
        } else {
          resolve(false);
        }
      }
    }
    
    check();
  });
}
