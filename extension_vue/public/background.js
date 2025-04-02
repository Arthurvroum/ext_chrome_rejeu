// Global variables to store recording state and captured requests
let isRecording = false;
let recordedRequests = [];
let capturedVariables = {};
let activeTabId = null;
let recordingStartTime = null;

// Import utilities
try {
  importScripts('message-utils.js');
  importScripts('tab-manager.js');
  importScripts('connection-utils.js');
  console.log('Dependencies loaded successfully');
} catch (e) {
  console.error('Failed to load dependencies:', e);
}

// Log function for debugging
function logDebug(message, data) {
  console.log(`[Background] ${message}`, data || '');
}

// Initialize state when the extension loads
chrome.runtime.onInstalled.addListener(() => {
  logDebug('Extension installed/updated');
  try {
    chrome.storage.local.get(['recordingState'], (result) => {
      if (result.recordingState) {
        isRecording = result.recordingState.isRecording || false;
        activeTabId = result.recordingState.activeTabId || null;
        recordingStartTime = result.recordingState.recordingStartTime || null;
        
        if (isRecording) {
          logDebug('Restored recording state', { activeTabId, recordingStartTime });
          // Also try to restore recorded requests if available
          chrome.storage.local.get(['recordedRequests'], (data) => {
            if (data.recordedRequests) {
              recordedRequests = data.recordedRequests;
              logDebug('Restored recorded requests', recordedRequests.length);
            }
          });
        }
      }
    });
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

// Save recording state to persistent storage
function saveRecordingState() {
  chrome.storage.local.set({
    recordingState: {
      isRecording,
      activeTabId,
      recordingStartTime
    }
  });
  
  // Also save captured requests periodically
  if (isRecording && recordedRequests.length > 0) {
    chrome.storage.local.set({ recordedRequests });
  }
}

// Listen for tab updates - use MV3 compatible approach
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isRecording && tabId === activeTabId && changeInfo.status === 'complete') {
    logDebug('Tracked tab was updated/navigated', { tabId, url: tab.url });
    
    // Use connection utilities to ensure content script is loaded
    setTimeout(() => {
      try {
        self.connectionUtils.ensureContentScript(tabId, success => {
          if (success) {
            logDebug('Content script is available after navigation');
            self.messageUtils.safelySendTabMessage(tabId, { action: 'startObserving' }, response => {
              logDebug('Content script response after navigation:', response);
            });
          } else {
            logDebug('Failed to ensure content script is loaded in tab after multiple attempts');
          }
        });
      } catch (error) {
        logDebug('Exception during tab update handling', error.message);
      }
    }, 1000); // Increased timeout to ensure page is ready
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logDebug('Received message:', request.action);
  
  // First check for extension health
  if (request.action === 'checkExtensionStatus') {
    sendResponse({ status: 'Background script is active' });
    return true;
  }
  
  // Always respond to basic queries, even if other functionality fails
  if (request.action === 'getRecordingStatus') {
    sendResponse({ 
      isRecording, 
      activeTabId, 
      recordingStartTime,
      requestCount: recordedRequests.length,
      extensionStatus: 'OK'
    });
    return true;
  }
  
  if (request.action === 'startRecording') {
    isRecording = true;
    recordedRequests = [];
    activeTabId = request.tabId;
    recordingStartTime = Date.now();
    logDebug('Recording started for tab:', activeTabId);
    saveRecordingState();
    sendResponse({ status: 'Recording started' });
  } 
  else if (request.action === 'stopRecording') {
    isRecording = false;
    logDebug('Recording stopped. Captured requests:', recordedRequests.length);
    saveRecordingState();
    sendResponse({ 
      status: 'Recording stopped', 
      data: recordedRequests 
    });
    // Clear stored requests after sending them to the popup
    chrome.storage.local.remove('recordedRequests');
  }
  else if (request.action === 'getRecordedData') {
    sendResponse({ data: recordedRequests });
  }
  else if (request.action === 'getCurrentTabId') {
    // Added to help content scripts identify themselves
    sendResponse({ id: sender.tab?.id });
  }
  else if (request.action === 'convertToOpenAPI') {
    const openApiSpec = convertToOpenAPI(request.data);
    sendResponse({ openApiSpec });
  }
  else if (request.action === 'replayRequests') {
    replayRequests(request.scenario)
      .then(results => sendResponse({ status: 'Replay completed', results }))
      .catch(error => sendResponse({ status: 'Replay failed', error: error.message }));
    return true; // Required for async response
  }
  else if (request.action === 'captureVariable') {
    capturedVariables[request.name] = request.value;
    sendResponse({ status: 'Variable captured' });
  }
  else if (request.action === 'startReplayWithTracking') {
    startReplayWithTracking(request.steps, request.options)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
  else if (request.action === 'stopReplay') {
    const result = stopLiveReplay();
    sendResponse(result);
  }
  else if (request.action === 'openAdvancedWindow') {
    logDebug('Opening advanced tab', request.tab);
    try {
      // Use local function instead of expecting a global
      openAdvancedTab(request.tab || 'record', (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error in response handling:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response);
        }
      });
      return true;
    } catch (error) {
      console.error('Error opening advanced tab:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  else if (request.action === 'openReplayWindow') {
    logDebug('Opening replay tab', { dataLength: request.data?.length });
    try {
      // We use the function directly without relying on window
      openReplayTab(request.data, (response) => {
        sendResponse(response);
      });
      return true; // Keep the message channel open for async response
    } catch (error) {
      console.error('Error opening replay tab:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  else if (request.action === 'updateReplayProgress') {
    try {
      // We use the function directly without relying on window
      updateReplayProgress(request.progressData, (response) => {
        sendResponse(response);
      });
      return true;
    } catch (error) {
      console.error('Error updating replay progress:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  else {
    // Unknown action
    logDebug('Unknown action received:', request.action);
    sendResponse({ status: 'error', message: 'Unknown action' });
  }
  
  // In MV3, we need to return true for asynchronous responses
  return true;
});

// Set up web request listener for capturing requests - MV3 compatible
chrome.webRequest.onBeforeRequest.addListener(
  captureRequest,
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  captureRequestHeaders,
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
  captureResponse,
  { urls: ["<all_urls>"] }
);

// Function to capture request data
function captureRequest(details) {
  if (!isRecording) return;
  
  // Check if it's from the tab we're recording or any of its frames
  if (details.tabId !== activeTabId) {
    return;
  }
  
  logDebug('Capturing request:', details.url);
  
  // In MV3, request body is not available by default
  // We need to work without it or use declarativeNetRequest
  let requestData = {
    id: details.requestId,
    url: details.url,
    method: details.method,
    type: details.type,
    frameId: details.frameId,
    parentFrameId: details.parentFrameId,
    timeStamp: details.timeStamp
  };
  
  // Add to recordedRequests, and check if it already exists by requestId
  const existingIndex = recordedRequests.findIndex(req => req.id === details.requestId);
  if (existingIndex >= 0) {
    // Update existing record
    recordedRequests[existingIndex] = {
      ...recordedRequests[existingIndex],
      ...requestData
    };
  } else {
    // Add new record
    recordedRequests.push(requestData);
  }
  
  // Periodically save the state to handle potential crashes
  if (recordedRequests.length % 10 === 0) {
    saveRecordingState();
  }
}

// Function to capture request headers
function captureRequestHeaders(details) {
  if (!isRecording || details.tabId !== activeTabId) return;
  
  const existingRequest = recordedRequests.find(req => req.id === details.requestId);
  if (existingRequest) {
    existingRequest.requestHeaders = details.requestHeaders;
  } else {
    // Sometimes headers arrive before the actual request
    recordedRequests.push({
      id: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      timeStamp: details.timeStamp,
      requestHeaders: details.requestHeaders
    });
  }
}

// Function to capture response
function captureResponse(details) {
  if (!isRecording || details.tabId !== activeTabId) return;
  
  const existingRequest = recordedRequests.find(req => req.id === details.requestId);
  if (existingRequest) {
    existingRequest.responseHeaders = details.responseHeaders;
    existingRequest.statusCode = details.statusCode;
    existingRequest.fromCache = details.fromCache;
    
    // Process variable capture if regex patterns are defined
    if (existingRequest.variableCapture) {
      processVariableCapture(existingRequest);
    }
  }
}

// Function to process variable capture using regex
function processVariableCapture(request) {
  // This would be implemented based on the configuration from the UI
  // Example: extracting values from response body or headers using regex
}

// Function to replay requests
async function replayRequests(scenario) {
  const results = [];
  const stopOnError = scenario.options?.stopOnError || false;
  
  for (const step of scenario.steps) {
    // Skip step if configured to be skipped
    if (step.skip) {
      results.push({ step: step.name, status: 'skipped' });
      continue;
    }
    
    try {
      // Process variable substitution
      const processedRequest = processVariableSubstitution(step, capturedVariables);
      
      // Execute the request
      const response = await executeRequest(processedRequest);
      
      // Process variable capture from response
      if (step.variableCapture) {
        processStepVariableCapture(response, step.variableCapture);
      }
      
      results.push({
        step: step.name,
        status: 'success',
        request: processedRequest,
        response: response
      });
    } catch (error) {
      results.push({
        step: step.name,
        status: 'error',
        error: error.message
      });
      
      if (stopOnError) break;
    }
  }
  
  return results;
}

// Helper function for variable substitution
function processVariableSubstitution(step, variables) {
  // Clone the step to avoid modifying the original
  const processedStep = JSON.parse(JSON.stringify(step));
  
  // Implement substitution logic
  // Example: replace ${variableName} in URL, headers, body
  
  return processedStep;
}

// Helper function to execute a request
async function executeRequest(requestData) {
  // Implement actual request execution
  // This would use fetch or XMLHttpRequest
}

// Helper function for capturing variables from a response
function processStepVariableCapture(response, captureConfig) {
  // Implement variable capture logic
}

// Convert recorded requests to OpenAPI 3.0 format
function convertToOpenAPI(requests) {
  logDebug('Converting to OpenAPI:', requests.length);
  
  // Implement conversion logic
  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Recorded API Requests',
      version: '1.0.0',
      description: 'Requests recorded by Network Request Recorder & Replay'
    },
    paths: {}
  };
  
  // Group requests by URL and method
  requests.forEach(request => {
    const url = request.url;
    const method = request.method.toLowerCase();
    
    // Skip non-API requests or static assets
    if (request.type !== 'xmlhttprequest' && 
        !url.includes('/api/') && 
        (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.png') || 
         url.endsWith('.jpg') || url.endsWith('.gif') || url.endsWith('.svg'))) {
      return;
    }
    
    // Extract path without query parameters
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      // Skip invalid URLs
      return;
    }
    
    const path = urlObj.pathname;
    
    // Initialize path entry if it doesn't exist
    if (!openAPISpec.paths[path]) {
      openAPISpec.paths[path] = {};
    }
    
    // Create operation object
    openAPISpec.paths[path][method] = {
      summary: `${method.toUpperCase()} ${path}`,
      description: `Recorded ${method.toUpperCase()} request to ${path}`,
      operationId: `${method}${path.replace(/\//g, '_')}`,
      parameters: [],
      responses: {
        '200': {
          description: 'Successful operation'
        }
      }
    };
    
    // Add request body if applicable
    if (request.requestBody && (method === 'post' || method === 'put' || method === 'patch')) {
      openAPISpec.paths[path][method].requestBody = {
        content: {
          'application/json': {
            schema: {
              type: 'object'
            }
          }
        }
      };
    }
    
    // Add variable capture if configured
    if (request.variableCapture && request.variableCapture.length > 0) {
      openAPISpec.paths[path][method]['x-variable-capture'] = request.variableCapture;
    }
  });
  
  return openAPISpec;
}

// Add these new functions for live replay with tracking

// Variable to store replay state
let isLiveReplaying = false;
let liveReplaySteps = [];
let currentStepIndex = -1;
let replayOptions = {};

// New function to start replay with tracking
async function startReplayWithTracking(steps, options) {
  isLiveReplaying = true;
  liveReplaySteps = steps;
  currentStepIndex = -1;
  replayOptions = options || {};
  
  logDebug('Starting replay with tracking', { steps: steps.length, options });
  
  // Execute each step and update progress
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Skip if configured
    if (step.skip) {
      updateReplayProgress(i, 'skipped');
      continue;
    }
    
    // Mark as in progress
    currentStepIndex = i;
    updateReplayProgress(i, 'in-progress');
    
    try {
      // Process variable substitution
      const processedRequest = processVariableSubstitution(step, capturedVariables);
      
      // Send request details
      updateReplayProgress(i, 'in-progress', { request: processedRequest });
      
      // Execute the request
      const response = await executeRequest(processedRequest);
      
      // Process variable capture
      let capturedVars = {};
      if (step.variableCaptures && step.variableCaptures.length > 0) {
        capturedVars = processStepVariableCapture(response, step.variableCaptures);
      }
      
      // Send success status
      updateReplayProgress(i, 'success', { 
        request: processedRequest,
        response: response,
        variables: capturedVars
      });
    } catch (error) {
      // Send error status
      updateReplayProgress(i, 'error', { error: error.message });
      
      // Stop if configured to stop on error
      if (replayOptions.stopOnError) {
        break;
      }
    }
  }
  
  // Mark as complete
  isLiveReplaying = false;
  updateReplayProgress(-1, 'complete');
  
  return { status: 'Replay completed', steps: liveReplaySteps };
}

// Function to stop live replay
function stopLiveReplay() {
  isLiveReplaying = false;
  return { status: 'Replay stopped manually' };
}

// Helper function to update replay progress
function updateReplayProgress(stepIndex, status, data = {}) {
  // Create progress data object
  const progressData = {
    stepIndex,
    status,
    timestamp: Date.now(),
    ...data
  };
  
  // Send progress update to window manager
  chrome.runtime.sendMessage({
    action: 'updateReplayProgress',
    progressData
  });
  
  // Save progress data to storage for the replay window to access
  chrome.storage.local.set({
    replayProgress: progressData,
    replayProgressTimestamp: Date.now()
  });
  
  return { success: true };
}

// Helper function to safely send messages to tabs with retry mechanism
function safelySendTabMessage(tabId, message, callback = null, retries = 3) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError.message);
      
      // If we have retries left, try again after a delay
      if (retries > 0) {
        setTimeout(() => {
          safelySendTabMessage(tabId, message, callback, retries - 1);
        }, 500);
      } else if (callback) {
        callback({ error: chrome.runtime.lastError.message });
      }
    } else if (callback) {
      callback(response);
    }
  });
}
