import { 
  sendMessageToBackground, 
  sendMessageToTab, 
  getActiveTab, 
  isRestrictedUrl,
  injectContentScript,
  checkContentScriptReady
} from '../utils/chromeApi';

import { isRelativeUrl } from '../utils/formatting';

let lastReplayTabOpenTime = 0;
const MIN_INTERVAL_BETWEEN_TABS = 2000; // 2 seconds minimum between tab opens

/**
 * Service for handling network request recording
 */
const recordService = {
  /**
   * Get current recording status
   * @returns {Promise} - Promise that resolves with the recording status
   */
  async getRecordingStatus() {
    try {
      const response = await sendMessageToBackground({ action: 'getRecordingStatus' });
      return response;
    } catch (error) {
      console.error('Error getting recording status:', error);
      return { isRecording: false, error: error.message };
    }
  },
  
  /**
   * Start recording network requests
   * @returns {Promise} - Promise that resolves when recording starts
   */
  async startRecording() {
    try {
      // Get active tab
      const activeTab = await getActiveTab();
      
      // Check if URL is restricted
      if (isRestrictedUrl(activeTab.url)) {
        return { 
          status: 'error', 
          error: 'Cannot record from restricted URLs like browser pages or extension pages',
          restrictedUrl: true
        };
      }
      
      // Ensure content script is ready
      const isReady = await checkContentScriptReady(activeTab.id);
      if (!isReady) {
        try {
          await injectContentScript(activeTab.id);
          // Wait a bit for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.warn('Error injecting content script:', error);
          // Continue anyway - some features may not work
        }
      }
      
      // Start recording
      const response = await sendMessageToBackground({
        action: 'startRecording',
        tabId: activeTab.id
      });
      
      // Notify content script to start observing
      try {
        await sendMessageToTab(activeTab.id, { action: 'startObserving' });
      } catch (error) {
        console.warn('Error notifying content script:', error);
      }
      
      return response;
    } catch (error) {
      console.error('Error starting recording:', error);
      return { status: 'error', error: error.message };
    }
  },
  
  /**
   * Stop recording network requests
   * @returns {Promise} - Promise that resolves with the recorded data
   */
  async stopRecording() {
    try {
      // Stop recording in background script
      const response = await sendMessageToBackground({ action: 'stopRecording' });
      
      // Get active tab
      const activeTab = await getActiveTab();
      
      // Notify content script to stop observing
      try {
        await sendMessageToTab(activeTab.id, { action: 'stopObserving' });
      } catch (error) {
        console.warn('Error notifying content script:', error);
        // Continue anyway - this is not critical
      }
      
      // Handle potential empty or invalid response
      if (!response) {
        console.warn('Empty response from background script when stopping recording');
        return { 
          status: 'warning', 
          message: 'Recording stopped, but no data was returned',
          data: [] // Return empty array instead of undefined
        };
      }
      
      // Handle error in response
      if (response.error) {
        console.error('Error in stop recording response:', response.error);
        return { 
          status: 'error', 
          error: response.error,
          data: response.data || [] // Use data if available or empty array
        };
      }
      
      // Handle case where data is missing but no error was reported
      if (!response.data && response.status === 'Recording stopped') {
        console.warn('No data in successful stop recording response');
        return {
          status: 'success',
          message: 'Recording stopped successfully',
          data: [] // Return empty array instead of undefined
        };
      }
      
      // Normal successful case
      return response;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return { 
        status: 'error', 
        error: error.message || 'Unknown error stopping recording',
        data: [] // Provide empty data array to prevent undefined errors
      };
    }
  },
  
  /**
   * Export recorded requests as OpenAPI 3.0 format
   * @param {Array} requests - The recorded requests to export
   * @returns {Promise} - Promise that resolves when export is complete
   */
  async exportAsOpenAPI(requests) {
    try {
      const response = await sendMessageToBackground({
        action: 'convertToOpenAPI',
        data: requests
      });
      
      if (response && response.openApiSpec) {
        // Validate the OpenAPI spec
        validateOpenApiSpec(response.openApiSpec);
        
        // Create downloadable file
        const blob = new Blob([JSON.stringify(response.openApiSpec, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recorded-requests.json';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return { success: true };
      } else {
        throw new Error('Failed to convert to OpenAPI format');
      }
    } catch (error) {
      console.error('Error exporting as OpenAPI:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Open replay in a new tab with the recorded data
   * @param {Array} recordedRequests - The recorded requests to replay (can be empty)
   * @returns {Promise} - Promise that resolves when replay tab is opened
   */
  async openReplayInNewTab(recordedRequests = []) {
    // Prevent multiple calls within a short time period
    const now = Date.now();
    if (now - lastReplayTabOpenTime < MIN_INTERVAL_BETWEEN_TABS) {
      console.log('Ignoring duplicate openReplayInNewTab call', 
        'Last call:', lastReplayTabOpenTime, 
        'Current time:', now,
        'Difference:', now - lastReplayTabOpenTime);
      return { success: false, error: 'Too many requests. Try again in a moment.' };
    }
    
    lastReplayTabOpenTime = now;
    
    try {
      // Create a deep copy of the data to avoid reference issues
      // If no requests are provided, use an empty array
      const requestsToSend = recordedRequests ? JSON.parse(JSON.stringify(recordedRequests)) : [];
      
      // Use a unique timestamp for this data to prevent confusion with previous requests
      const dataTimestamp = Date.now();
      
      // Save data to storage for replay tab to access
      await chrome.storage.local.set({
        latestRecordedData: requestsToSend,
        replayWindowData: requestsToSend,
        replayWindowDataCount: requestsToSend.length,
        autoLoadLatestRecording: true,
        recordingTimestamp: dataTimestamp,
        lastReplayTabRequest: dataTimestamp // Mark when we last requested a tab
      });
      
      // Open replay tab with a unique timestamp to prevent caching
      const response = await sendMessageToBackground({
        action: 'openReplayWindow',
        data: requestsToSend,
        count: requestsToSend.length,
        timestamp: dataTimestamp // Add timestamp to make each request unique
      });
      
      return response;
    } catch (error) {
      console.error('Error opening replay tab:', error);
      return { success: false, error: error.message };
    }
  }
};

// Validate the OpenAPI spec has the minimum required fields
function validateOpenApiSpec(spec) {
  if (!spec.openapi || !spec.openapi.startsWith('3.0')) {
    console.warn('Warning: OpenAPI version should be 3.0.x');
  }
  
  if (!spec.info) {
    console.warn('Warning: Missing info object in OpenAPI spec');
  }
  
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    console.warn('Warning: No paths defined in OpenAPI spec');
  }
  
  // Check for x-original-urls map
  if (!spec['x-original-urls'] || Object.keys(spec['x-original-urls']).length === 0) {
    console.warn('Warning: Missing x-original-urls map for proper replay');
  }
  
  return true;
}

export default recordService;
