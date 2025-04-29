/**
 * Content script for Network Request Recorder & Replay
 * This runs in the context of web pages and handles form submissions and DOM observations
 */

console.log('Content script loaded and initializing...');

// Keep track of our initialization status
let contentScriptInitialized = false;
let isObserving = false;
let observationStartTime = null;
let initializationAttempts = 0;

// Initialize content script
function initialize() {
  if (contentScriptInitialized) return;
  
  initializationAttempts++;
  console.log(`Initializing content script (attempt ${initializationAttempts})`);
  
  try {
    // Set up message listeners
    setupMessageListeners();
    
    // Mark as initialized
    contentScriptInitialized = true;
    
    // Send initialization success message
    try {
      chrome.runtime.sendMessage({ 
        action: 'contentScriptInitialized',
        url: window.location.href,
        timestamp: Date.now()
      });
      console.log('Content script initialization complete');
    } catch (e) {
      console.warn('Failed to send initialization message:', e);
    }
  } catch (e) {
    console.error('Error during content script initialization:', e);
    
    // Retry initialization up to 3 times
    if (initializationAttempts < 3) {
      setTimeout(initialize, 500);
    }
  }
}

// Set up message listeners with better error handling
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.action);
    
    // Always respond to ping messages to confirm content script is active
    if (message.action === 'pingContentScript' || message.action === 'ping') {
      sendResponse({
        status: 'active',
        initialized: contentScriptInitialized,
        url: window.location.href,
        isObserving: isObserving,
        timestamp: Date.now()
      });
      return true; // Keep the messaging channel open for async response
    }
    
    if (message.action === 'startObserving') {
      startObserving();
      sendResponse({ 
        status: 'observation started',
        timestamp: Date.now()
      });
      return true;
    }
    
    if (message.action === 'stopObserving') {
      stopObserving();
      sendResponse({ 
        status: 'observation stopped',
        timestamp: Date.now()
      });
      return true;
    }
    
    // Default response for unknown actions
    sendResponse({ 
      status: 'unknown action',
      timestamp: Date.now()
    });
    return true;
  });
  
  console.log('Message listeners set up successfully');
}

// Start observing forms and other interactive elements
function startObserving() {
  if (isObserving) return;
  
  console.log('Starting DOM observation');
  isObserving = true;
  observationStartTime = Date.now();
  
  // Set up form submission listeners
  setupFormListeners();
  
  // Set up fetch/XHR interceptors if possible
  setupNetworkInterceptors();
}

// Stop observing 
function stopObserving() {
  if (!isObserving) return;
  
  console.log('Stopping DOM observation');
  isObserving = false;
  
  // Cleanup could be done here
}

// Set up form submission listeners
function setupFormListeners() {
  // Find all forms on the page
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    form.addEventListener('submit', captureFormSubmission);
  });
  
  console.log(`Monitoring ${forms.length} forms for submissions`);
}

// Capture form submission data
function captureFormSubmission(event) {
  if (!isObserving) return;
  
  // Get form data
  const form = event.target;
  const formData = new FormData(form);
  const formDataObj = {};
  
  for (const [key, value] of formData.entries()) {
    formDataObj[key] = value;
  }
  
  // Send to background script
  try {
    chrome.runtime.sendMessage({
      action: 'captureFormSubmission',
      method: form.method || 'GET',
      url: form.action || window.location.href,
      data: formDataObj,
      timestamp: Date.now()
    });
  } catch (e) {
    console.warn('Failed to send form data:', e);
  }
}

// Set up network request interceptors if possible
function setupNetworkInterceptors() {
  // This is complex and may not work in all browsers
  // We'll add basic implementation here
  console.log('Network interceptors not implemented in content script');
}

// Initialize immediately
initialize();

// Export for testing
window.contentScriptAPI = {
  isInitialized: () => contentScriptInitialized,
  isObserving: () => isObserving,
  startObserving,
  stopObserving
};
