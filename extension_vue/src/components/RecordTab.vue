<template>
  <div class="record-tab">
    <div class="recording-status" :class="{ 'recording-active': isRecording }">
      <span v-if="isRecording">Recording in progress... ({{ recordedCount }} requests)</span>
      <span v-else>Ready to record</span>
    </div>
    
    <div class="controls">
      <button 
        @click="toggleRecording" 
        :class="{ 'recording': isRecording }"
      >
        {{ isRecording ? 'Stop Recording' : 'Start Recording' }}
      </button>
      <button 
        @click="exportRecording" 
        :disabled="!hasRecordedData"
      >
        Export (OpenAPI 3.0)
      </button>
      <button 
        @click="clearRecordings" 
        :disabled="!hasRecordedData"
      >
        Clear Data
      </button>
    </div>

    <div class="status">
      {{ recordingStatus }}
    </div>

    <!-- Add replay option after recording stops -->
    <div v-if="showReplayOption" class="replay-option">
      <p>Recording completed with {{ recordedRequests.length }} requests.</p>
      <div class="replay-buttons">
        <button @click="openReplayInNewTab" class="replay-now-btn">
          Open Replay Tab
        </button>
        <button @click="exportRecording" class="export-btn">
          Export (OpenAPI 3.0)
        </button>
      </div>
    </div>

    <div class="request-list" v-if="hasRecordedData">
      <h3>Recorded Requests ({{ recordedRequests.length }})</h3>
      <div class="request-item" v-for="(request, index) in recordedRequests" :key="index">
        <div class="request-header">
          <span class="method">{{ request.method }}</span>
          <span class="url">{{ request.url }}</span>
          <span class="status" v-if="request.statusCode">{{ request.statusCode }}</span>
        </div>
        <div class="request-details" v-if="expandedRequest === index">
          <div class="detail-section">
            <h4>Request Headers</h4>
            <pre>{{ formatHeaders(request.requestHeaders) }}</pre>
          </div>
          <div class="detail-section" v-if="request.requestBody">
            <h4>Request Body</h4>
            <pre>{{ formatBody(request.requestBody) }}</pre>
          </div>
          <div class="detail-section" v-if="request.responseHeaders">
            <h4>Response Headers</h4>
            <pre>{{ formatHeaders(request.responseHeaders) }}</pre>
          </div>
          <div class="detail-section">
            <h4>Variable Capture</h4>
            <div class="variable-capture">
              <div class="form-group">
                <label>Regex Pattern:</label>
                <input type="text" v-model="captureRegex" placeholder="e.g. token:([A-Za-z0-9]+)">
              </div>
              <div class="form-group">
                <label>Variable Name:</label>
                <input type="text" v-model="captureName" placeholder="e.g. authToken">
              </div>
              <div class="form-group">
                <label>Source:</label>
                <select v-model="captureSource">
                  <option value="responseBody">Response Body</option>
                  <option value="responseHeaders">Response Headers</option>
                  <option value="url">URL</option>
                </select>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="captureRequired">
                  Required
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="captureFailOnError">
                  Fail on Error
                </label>
              </div>
              <div class="form-group">
                <label>Scope:</label>
                <select v-model="captureScope">
                  <option value="global">Global</option>
                  <option value="step">This Step Only</option>
                </select>
              </div>
              <button @click="addVariableCapture(request, index)">Add Variable Capture</button>
            </div>
          </div>
        </div>
        <button class="toggle-details" @click="toggleDetails(index)">
          {{ expandedRequest === index ? 'Hide Details' : 'Show Details' }}
        </button>
      </div>
    </div>
    <div class="empty-state" v-else>
      <p>No requests recorded yet. Click "Start Recording" to begin capturing HTTP requests.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RecordTab',
  data() {
    return {
      isRecording: false,
      recordingStatus: 'Ready to record',
      recordedRequests: [],
      recordedCount: 0,
      expandedRequest: null,
      captureRegex: '',
      captureName: '',
      captureSource: 'responseBody',
      captureRequired: true,
      captureFailOnError: false,
      captureScope: 'global',
      showReplayOption: false
    }
  },
  mounted() {
    // Check if we're already recording when the popup opens
    this.checkRecordingStatus();
    
    // Set up polling to update request count during recording
    this.statusInterval = setInterval(() => {
      if (this.isRecording) {
        this.updateRecordingStatus();
      }
    }, 2000);
    
    // Add a connection retry mechanism for content scripts
    this.ensureContentScriptConnection();
  },
  beforeUnmount() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  },
  computed: {
    hasRecordedData() {
      return this.recordedRequests && this.recordedRequests.length > 0;
    }
  },
  methods: {
    // New method to ensure content script connection
    ensureContentScriptConnection() {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (!tabs || !tabs.length) return;
        
        const activeTab = tabs[0];
        console.log('Checking content script in tab:', activeTab.id);
        
        // Try to ping the content script with a retry mechanism
        const pingContentScript = (attempt = 1, maxAttempts = 3) => {
          try {
            chrome.tabs.sendMessage(
              activeTab.id, 
              { action: 'pingContentScript' }, 
              response => {
                if (chrome.runtime.lastError) {
                  console.warn('Content script not ready (attempt ' + attempt + '/' + maxAttempts + '):', 
                    chrome.runtime.lastError.message);
                  
                  if (attempt < maxAttempts) {
                    setTimeout(() => pingContentScript(attempt + 1, maxAttempts), 500);
                  } else {
                    console.warn('Content script unavailable after ' + maxAttempts + ' attempts');
                    // We might need to inject the content script
                    this.injectContentScript(activeTab.id);
                  }
                } else if (response) {
                  console.log('Content script is ready:', response);
                }
              }
            );
          } catch (error) {
            console.error('Error pinging content script:', error);
          }
        };
        
        // Start the ping process
        pingContentScript();
      });
    },
    
    // Update the injection method to use safe injector
    injectContentScript(tabId) {
      console.log('Attempting to inject content script into tab:', tabId);
      
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting tab info:', chrome.runtime.lastError.message);
          return;
        }
        
        // Skip chrome:// and other restricted URLs
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('file://')) {
          console.warn(`Cannot inject content script into restricted URL: ${tab.url}`);
          return;
        }
        
        // Only inject on http/https URLs
        if (tab.url.startsWith('http')) {
          try {
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content-script.js']
            }).then(() => {
              console.log('Content script injected successfully');
            }).catch(err => {
              console.error('Failed to inject content script:', err);
            });
          } catch (error) {
            console.error('Error during content script injection:', error);
          }
        }
      });
    },
    
    checkRecordingStatus() {
      chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
        if (response && response.isRecording) {
          this.isRecording = true;
          this.recordingStatus = 'Recording active...';
          this.recordedCount = response.requestCount || 0;
        }
      });
    },
    updateRecordingStatus() {
      chrome.runtime.sendMessage({ action: 'getRecordingStatus' }, (response) => {
        if (response) {
          this.recordedCount = response.requestCount || 0;
        }
      });
    },
    async toggleRecording() {
      try {
        if (!this.isRecording) {
          // Fix for Manifest V3 - use proper Promise syntax without mixing callbacks
          const tabs = await chrome.tabs.query({active: true, currentWindow: true});
          if (!tabs || tabs.length === 0) {
            this.recordingStatus = 'Error: Could not get active tab';
            console.error('No active tab found');
            return;
          }
          
          const activeTab = tabs[0];
          console.log('Active tab:', activeTab.id);
          
          // First ensure content script is ready
          await new Promise(resolve => {
            this.ensureContentScriptReadyWithTimeout(activeTab.id, resolve);
          });
          
          // Use Promise pattern consistently
          try {
            const response = await new Promise(resolve => {
              chrome.runtime.sendMessage(
                { action: 'startRecording', tabId: activeTab.id },
                result => {
                  if (chrome.runtime.lastError) {
                    console.error('Error starting recording:', chrome.runtime.lastError);
                    resolve(null);
                  } else {
                    resolve(result);
                  }
                }
              );
            });
            
            if (response && response.status) {
              this.isRecording = true;
              this.recordingStatus = 'Recording active...';
              console.log('Recording started successfully');
            } else {
              this.recordingStatus = 'Error starting recording';
              console.error('No valid response from background script');
            }
          } catch (err) {
            console.error('Runtime message error:', err);
            this.recordingStatus = `Error: ${err.message}`;
          }
          
          // Notify content script - also using proper Promise pattern
          try {
            await new Promise(resolve => {
              chrome.tabs.sendMessage(
                activeTab.id, 
                { action: 'startObserving' },
                response => {
                  if (chrome.runtime.lastError) {
                    console.warn('Content script warning:', chrome.runtime.lastError.message);
                  }
                  resolve(response);
                }
              );
            });
          } catch (error) {
            console.warn('Error communicating with content script:', error);
          }
          
          // Reset the replay option
          this.showReplayOption = false;
        } else {
          // Stop recording - also using Promise pattern correctly
          try {
            const response = await new Promise(resolve => {
              chrome.runtime.sendMessage(
                { action: 'stopRecording' },
                result => {
                  if (chrome.runtime.lastError) {
                    console.error('Error stopping recording:', chrome.runtime.lastError);
                    resolve(null);
                  } else {
                    resolve(result);
                  }
                }
              );
            });
            
            if (response && response.status) {
              this.isRecording = false;
              this.recordingStatus = 'Recording stopped';
              this.recordedRequests = response.data || [];
              console.log('Received recorded requests:', this.recordedRequests.length);
              
              // Show replay option if we have recorded data
              if (this.recordedRequests.length > 0) {
                this.showReplayOption = true;
                
                // Save recorded data to storage for the replay tab
                chrome.storage.local.set({ 
                  latestRecordedData: this.recordedRequests 
                });
              }
            } else {
              this.recordingStatus = 'Error stopping recording';
              console.error('No valid response from background script');
            }
          } catch (err) {
            console.error('Runtime message error:', err);
            this.recordingStatus = `Error: ${err.message}`;
          }
          
          // Get the active tab with proper Manifest V3 Promise API
          const tabs = await chrome.tabs.query({active: true, currentWindow: true});
          
          if (tabs && tabs.length > 0) {
            // Notify content script to stop observing
            try {
              chrome.tabs.sendMessage(
                tabs[0].id, 
                { action: 'stopObserving' }
              );
            } catch (error) {
              console.warn('Error communicating with content script:', error);
            }
          }
        }
      } catch (error) {
        console.error('Unexpected error in toggleRecording:', error);
        this.recordingStatus = `Error: ${error.message}`;
      }
    },
    exportRecording() {
      // Convert to OpenAPI format
      chrome.runtime.sendMessage(
        { 
          action: 'convertToOpenAPI', 
          data: this.recordedRequests 
        },
        (response) => {
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
          }
        }
      );
    },
    clearRecordings() {
      this.recordedRequests = [];
      this.recordingStatus = 'Data cleared';
    },
    toggleDetails(index) {
      this.expandedRequest = this.expandedRequest === index ? null : index;
    },
    formatHeaders(headers) {
      if (!headers) return 'No headers available';
      return JSON.stringify(headers, null, 2);
    },
    formatBody(body) {
      if (!body) return 'Request body not available in Manifest V3. Use content scripts to capture form submissions.';
      
      // Try to parse as JSON if it's a string
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          return JSON.stringify(parsed, null, 2);
        } catch (e) {
          return body;
        }
      }
      
      return JSON.stringify(body, null, 2);
    },
    addVariableCapture(request, /* index */) {
      if (!this.captureRegex || !this.captureName) {
        alert('Please provide both a regex pattern and variable name');
        return;
      }
      
      // Add variable capture configuration to the request
      if (!request.variableCapture) {
        request.variableCapture = [];
      }
      
      request.variableCapture.push({
        name: this.captureName,
        regex: this.captureRegex,
        source: this.captureSource,
        required: this.captureRequired,
        failOnError: this.captureFailOnError,
        scope: this.captureScope
      });
      
      // Update the requests array
      this.recordedRequests = [...this.recordedRequests];
      
      // Reset form
      this.captureRegex = '';
      this.captureName = '';
    },
    
    // Update the replayNow method to open a new window
    replayNow() {
      // Save the data and emit event to open replay tab
      chrome.storage.local.set({ 
        latestRecordedData: this.recordedRequests,
        autoLoadLatestRecording: true
      }, () => {
        // Emit event to parent component to switch to replay tab or open new window
        this.$emit('open-replay');
      });
    },
    
    // Rename the method to reflect it's opening a tab now
    openReplayInNewTab() {
      console.log('Attempting to open replay in new tab...');
      chrome.runtime.sendMessage({
        action: 'openReplayWindow',
        data: this.recordedRequests
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening replay tab:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('Replay tab opened with ID:', response.tabId);
        } else {
          console.error('Failed to open replay tab, unexpected response:', response);
        }
      });
    },
    
    // New helper method for content script readiness with timeout
    ensureContentScriptReadyWithTimeout(tabId, callback, timeout = 3000) {
      const startTime = Date.now();
      
      const checkContentScript = () => {
        try {
          chrome.tabs.sendMessage(
            tabId, 
            { action: 'pingContentScript' }, 
            response => {
              if (chrome.runtime.lastError) {
                // If we have time remaining, try again
                if (Date.now() - startTime < timeout) {
                  setTimeout(checkContentScript, 200);
                } else {
                  console.warn('Content script not ready within timeout, attempting to inject');
                  this.injectContentScript(tabId);
                  // Give some time for injection to complete
                  setTimeout(() => callback(false), 500);
                }
              } else if (response) {
                console.log('Content script ready:', response);
                callback(true);
              } else {
                callback(false);
              }
            }
          );
        } catch (error) {
          console.error('Error checking content script readiness:', error);
          callback(false);
        }
      };
      
      checkContentScript();
    }
  }
}
</script>

<style scoped>
.record-tab {
  text-align: left;
  padding: 5px;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: auto; /* Allow scrolling within tab content */
  flex: 1;
}

.recording-status {
  text-align: center;
  padding: 10px; /* Less padding */
  margin-bottom: 10px; /* Less margin */
  background-color: #f8f9fa;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1rem; /* Smaller text */
  box-shadow: 0 3px 10px rgba(0,0,0,0.1);
  flex-shrink: 0; /* Don't allow to shrink */
}

.recording-active {
  background-color: #ffebee;
  color: #d32f2f;
  animation: pulse 1.5s infinite;
  box-shadow: 0 3px 15px rgba(211, 47, 47, 0.3); /* Red-tinted shadow */
}

@keyframes pulse {
  0% { background-color: #ffebee; box-shadow: 0 3px 15px rgba(211, 47, 47, 0.3); }
  50% { background-color: #ffcdd2; box-shadow: 0 3px 20px rgba(211, 47, 47, 0.5); }
  100% { background-color: #ffebee; box-shadow: 0 3px 15px rgba(211, 47, 47, 0.3); }
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 5px; /* Less gap */
  margin-bottom: 10px; /* Less margin */
  justify-content: center;
  flex-shrink: 0; /* Don't allow to shrink */
}

button {
  padding: 8px 10px; /* Smaller buttons */
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem; /* Smaller text */
  transition: all 0.2s ease;
  box-shadow: 0 3px 8px rgba(0,0,0,0.1);
  flex: 1 1 auto;
  min-width: 80px; /* Smaller minimum width */
  max-width: 140px;
}

/* For full window mode, use larger buttons */
:global(.full-window) button {
  padding: 15px 25px;
  font-size: 1.1rem;
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0,0,0,0.15);
}

button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.recording {
  background-color: #dc3545;
  color: white;
  border-color: #dc3545;
  box-shadow: 0 3px 10px rgba(220, 53, 69, 0.4); /* Red shadow */
}

.status {
  font-style: italic;
  margin-bottom: 10px; /* Less margin */
  text-align: center;
  font-size: 0.9rem; /* Smaller text */
  flex-shrink: 0; /* Don't allow to shrink */
}

.replay-option {
  margin: 10px 0; /* Less margin */
  padding: 10px; /* Less padding */
  background-color: #e8f4ff;
  border-radius: 10px;
  text-align: center;
  animation: fadeIn 0.7s ease-in-out;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
  flex-shrink: 0; /* Don't allow to shrink */
}

.replay-option p {
  font-size: 1rem;
  margin-bottom: 10px;
}

.replay-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.replay-now-btn {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
  padding: 15px 30px;
  font-weight: bold;
  font-size: 1.15rem;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.replay-now-btn:hover {
  background-color: #0069d9;
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.4);
}

.export-btn {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
  padding: 15px 30px;
  font-size: 1.15rem;
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-15px); }
  to { opacity: 1; transform: translateY(0); }
}

.request-list {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
}

.request-item {
  border-bottom: 1px solid #dee2e6;
  padding: 10px;
}

.request-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.method {
  font-weight: bold;
  color: #007bff;
  width: 70px;
}

.url {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  color: #28a745;
}

.request-details {
  margin-top: 10px;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.detail-section {
  margin-bottom: 15px;
}

h4 {
  margin: 0 0 5px 0;
  color: #495057;
}

pre {
  background-color: #e9ecef;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 150px;
  font-size: 12px;
}

.toggle-details {
  background: none;
  border: none;
  color: #007bff;
  padding: 5px 0;
  cursor: pointer;
  text-decoration: underline;
}

.variable-capture {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background-color: #ffffff;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.form-group {
  margin-bottom: 10px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input[type="text"], select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

/* For full window mode, restore original sizes */
:global(.full-window) .record-tab button {
  padding: 15px 25px;
  font-size: 1.1rem;
}

:global(.full-window) .record-tab .recording-status {
  padding: 20px;
  margin-bottom: 25px;
  font-size: 1.2rem;
}

:global(.full-window) .record-tab .replay-option {
  margin: 25px 0;
  padding: 25px;
}
</style>
