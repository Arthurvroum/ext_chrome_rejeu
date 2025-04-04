import { 
  sendMessageToBackground, 
  sendMessageToTab, 
  getActiveTab, 
  isRestrictedUrl,
  injectContentScript,
  checkContentScriptReady
} from '../utils/chromeApi';

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
      }
      
      return response;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return { status: 'error', error: error.message };
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
   * @param {Array} recordedRequests - The recorded requests to replay
   * @returns {Promise} - Promise that resolves when replay tab is opened
   */
  async openReplayInNewTab(recordedRequests) {
    try {
      // Create a deep copy of the data to avoid reference issues
      const requestsToSend = JSON.parse(JSON.stringify(recordedRequests));
      
      // Save data to storage for replay tab to access
      await chrome.storage.local.set({
        latestRecordedData: requestsToSend,
        replayWindowData: requestsToSend,
        replayWindowDataCount: requestsToSend.length,
        autoLoadLatestRecording: true,
        recordingTimestamp: Date.now()
      });
      
      // Open replay tab
      const response = await sendMessageToBackground({
        action: 'openReplayWindow',
        data: requestsToSend,
        count: requestsToSend.length
      });
      
      return response;
    } catch (error) {
      console.error('Error opening replay tab:', error);
      return { success: false, error: error.message };
    }
  }
};

export default recordService;
