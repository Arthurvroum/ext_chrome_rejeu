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

// Create a namespace for connection utilities
// Ensure it works in both browser and service worker contexts
(function(globalContext) {
  // Maximum attempts for content script injection
  const MAX_CONTENT_SCRIPT_ATTEMPTS = 3;
  
  // Function to check if a URL is restricted (can't inject content scripts)
  function isRestrictedUrl(url) {
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
  
  // Function to ensure content script is loaded in a tab
  function ensureContentScriptLoaded(tabId, callback) {
    let attempts = 0;
    
    // Function to check and inject content script
    function tryInjectContentScript() {
      attempts++;
      console.log(`Ensuring content script is loaded (attempt ${attempts}/${MAX_CONTENT_SCRIPT_ATTEMPTS})`);
      
      try {
        chrome.tabs.sendMessage(tabId, { action: 'pingContentScript' }, response => {
          if (chrome.runtime.lastError) {
            console.log(`Content script not ready (attempt ${attempts}/${MAX_CONTENT_SCRIPT_ATTEMPTS}): ${chrome.runtime.lastError.message}`);
            
            if (attempts < MAX_CONTENT_SCRIPT_ATTEMPTS) {
              // Check if tab is valid and not a restricted URL
              chrome.tabs.get(tabId, tab => {
                if (chrome.runtime.lastError) {
                  console.error('Error getting tab:', chrome.runtime.lastError.message);
                  callback(false);
                  return;
                }
                
                // Check if URL is restricted
                if (isRestrictedUrl(tab.url)) {
                  console.warn('Cannot inject content script in restricted URL:', tab.url);
                  callback(false);
                  return;
                }
                
                // Try to inject the content script
                console.log('Injecting content script in tab:', tabId);
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  files: ['content-script.js']
                }).then(() => {
                  console.log(`Content script injected on attempt ${attempts}`);
                  // Wait a moment for the script to initialize
                  setTimeout(tryInjectContentScript, 300);
                }).catch(err => {
                  console.error(`Error injecting content script (attempt ${attempts}/${MAX_CONTENT_SCRIPT_ATTEMPTS}):`, err);
                  if (attempts < MAX_CONTENT_SCRIPT_ATTEMPTS) {
                    setTimeout(tryInjectContentScript, 300);
                  } else {
                    console.error('Content script unavailable after', MAX_CONTENT_SCRIPT_ATTEMPTS, 'attempts');
                    callback(false);
                  }
                });
              });
            } else {
              console.error('Content script unavailable after', MAX_CONTENT_SCRIPT_ATTEMPTS, 'attempts');
              callback(false);
            }
          } else {
            console.log('Content script is responsive:', response);
            callback(true);
          }
        });
      } catch (error) {
        console.error('Exception checking content script status:', error);
        if (attempts < MAX_CONTENT_SCRIPT_ATTEMPTS) {
          setTimeout(tryInjectContentScript, 300);
        } else {
          callback(false);
        }
      }
    }
    
    // Start the injection process
    tryInjectContentScript();
  }
  
  // Function to check if a content script is loaded
  function isContentScriptLoaded(tabId) {
    return new Promise(resolve => {
      try {
        chrome.tabs.sendMessage(tabId, { action: 'pingContentScript' }, response => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        console.warn('Error checking content script:', error);
        resolve(false);
      }
    });
  }
  
  // Function to wait for content script to be ready
  async function waitForContentScript(tabId, maxWaitMs = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const loaded = await isContentScriptLoaded(tabId);
      if (loaded) {
        return true;
      }
      // Wait a bit before checking again
      await new Promise(r => setTimeout(r, 200));
    }
    
    return false;
  }
  
  // Export functions in a way that works in both browser and service worker contexts
  const connectionUtils = {
    ensureContentScriptLoaded,
    isRestrictedUrl,
    isContentScriptLoaded,
    waitForContentScript
  };
  
  // Make it available in the global context
  if (typeof globalContext.connectionUtils === 'undefined') {
    globalContext.connectionUtils = connectionUtils;
  }
  
  // Log successful initialization
  console.log('Connection utils initialized successfully');
})(typeof self !== 'undefined' ? self : this);

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
