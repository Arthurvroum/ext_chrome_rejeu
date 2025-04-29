/**
 * Safe content script injector that avoids restricted URLs
 */

// Check if we can inject into the current tab
function canInjectContentScript(url) {
  if (!url) return false;
  
  // Cannot inject into chrome:// pages, chrome-extension:// pages, etc.
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('devtools://') ||
      url.startsWith('chrome-devtools://') ||
      url.startsWith('file://') ||
      url.startsWith('view-source:')) {
    console.warn(`Cannot inject content script into restricted URL: ${url}`);
    return false;
  }
  
  return true;
}

// Safe injection with URL check
function safeInjectContentScript(tabId, callback) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting tab info:', chrome.runtime.lastError.message);
      if (callback) callback(false);
      return;
    }
    
    if (!canInjectContentScript(tab.url)) {
      if (callback) callback(false);
      return;
    }
    
    // It's safe to inject
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-script.js']
    }).then(() => {
      console.log('Content script injected successfully into tab', tabId);
      if (callback) callback(true);
    }).catch(error => {
      console.error('Failed to inject content script:', error);
      if (callback) callback(false);
    });
  });
}

// Safe message sending with URL check
function safeSendTabMessage(tabId, message, callback) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting tab info:', chrome.runtime.lastError.message);
      if (callback) callback({ error: chrome.runtime.lastError.message });
      return;
    }
    
    if (!canInjectContentScript(tab.url)) {
      if (callback) callback({ error: 'Cannot send message to restricted URL' });
      return;
    }
    
    // It's safe to send message
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Error sending message:', chrome.runtime.lastError.message);
        if (callback) callback({ error: chrome.runtime.lastError.message });
      } else {
        if (callback) callback(response);
      }
    });
  });
}

// Export as global
window.contentScriptInjector = {
  safeInject: safeInjectContentScript,
  safeSendMessage: safeSendTabMessage,
  canInject: canInjectContentScript
};
