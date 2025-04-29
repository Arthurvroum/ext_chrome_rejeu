/**
 * Performance optimizations for Chrome Extension
 */

// Cache for faster lookups
const performanceCache = {
  activeTabId: null,
  contentScriptStatus: {},  // tabId -> status
  lastInjectionAttempt: {}  // tabId -> timestamp
};

// Optimize message passing
function optimizedSendMessage(target, message, callback) {
  try {
    // For runtime messages
    if (target === 'runtime') {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          console.warn('Runtime message error:', chrome.runtime.lastError.message);
          if (callback) callback(null);
        } else if (callback) {
          callback(response);
        }
      });
    } 
    // For content script messages
    else if (typeof target === 'number') {
      chrome.tabs.sendMessage(target, message, response => {
        if (chrome.runtime.lastError) {
          console.warn(`Content script message error for tab ${target}:`, chrome.runtime.lastError.message);
          
          // Mark content script as unavailable in cache
          performanceCache.contentScriptStatus[target] = false;
          
          if (callback) callback(null);
        } else {
          // Mark content script as available in cache
          performanceCache.contentScriptStatus[target] = true;
          
          if (callback) callback(response);
        }
      });
    }
  } catch (error) {
    console.error('Message send error:', error);
    if (callback) callback(null);
  }
}

// Fast content script injection check
function optimizedEnsureContentScript(tabId, callback) {
  // Use cached result if available and recent (last 5 seconds)
  const now = Date.now();
  const lastAttempt = performanceCache.lastInjectionAttempt[tabId] || 0;
  
  if (performanceCache.contentScriptStatus[tabId] && (now - lastAttempt) < 5000) {
    callback(true);
    return;
  }
  
  // Check if content script is loaded
  optimizedSendMessage(tabId, { action: 'pingContentScript' }, response => {
    if (response) {
      performanceCache.contentScriptStatus[tabId] = true;
      callback(true);
    } else {
      // Need to inject
      performanceCache.lastInjectionAttempt[tabId] = now;
      
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content-script.js']
      }).then(() => {
        // Wait a moment for initialization
        setTimeout(() => {
          optimizedSendMessage(tabId, { action: 'pingContentScript' }, secondResponse => {
            performanceCache.contentScriptStatus[tabId] = !!secondResponse;
            callback(!!secondResponse);
          });
        }, 100);
      }).catch(error => {
        console.error('Script injection error:', error);
        performanceCache.contentScriptStatus[tabId] = false;
        callback(false);
      });
    }
  });
}

// Make available globally
window.performanceOpt = {
  cache: performanceCache,
  sendMessage: optimizedSendMessage,
  ensureContentScript: optimizedEnsureContentScript
};

console.log('Performance optimizations loaded');
