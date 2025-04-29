<template>
  <div class="record-tab">
    <!-- Recording controls -->
    <record-controls
      :is-recording="isRecording"
      :recorded-count="recordedCount"
      :status="recordingStatus"
      :has-recorded-data="hasRecordedData"
      :disabled="restrictedUrlWarning"
      @toggle-recording="toggleRecording"
      @export-recording="exportRecording"
      @clear-recordings="clearRecordings"
      @open-replay-tab="openReplayInNewTab"
    />
    
    <!-- URL restriction warning -->
    <v-alert
      v-if="restrictedUrlWarning"
      type="warning"
      variant="tonal"
      icon="mdi-alert"
      border="start"
      class="mb-4"
    >
      <v-alert-title>Cannot record from this page</v-alert-title>
      Recording is not possible on browser internal pages or extension pages. Please navigate to a regular website to use recording features.
    </v-alert>

    <!-- Request list -->
    <v-card v-if="hasRecordedData" variant="outlined">
      <v-card-title class="bg-grey-lighten-4">
        <v-icon icon="mdi-format-list-bulleted" class="mr-2"></v-icon>
        Recorded Requests ({{ recordedRequests.length }})
      </v-card-title>
      
      <v-list>
        <v-list-item
          v-for="(request, index) in recordedRequests"
          :key="index"
          :subtitle="request.url"
          :value="index"
        >
          <template v-slot:prepend>
            <v-chip
              :color="getMethodColor(request.method)"
              size="small"
              label
              class="mr-2"
            >
              {{ request.method }}
            </v-chip>
          </template>
          
          <template v-slot:append>
            <v-chip
              v-if="request.statusCode"
              :color="getStatusColor(request.statusCode)"
              size="small"
              label
            >
              {{ request.statusCode }}
            </v-chip>
            <v-btn
              variant="text"
              size="small"
              icon="mdi-chevron-down"
              @click="toggleDetails(index)"
              :class="{ 'rotate-icon': expandedRequest === index }"
            ></v-btn>
          </template>
          
          <v-expand-transition>
            <div v-if="expandedRequest === index">
              <v-divider></v-divider>
              <v-card flat>
                <v-tabs v-model="activeTab">
                  <v-tab value="headers">Request Headers</v-tab>
                  <v-tab value="body" v-if="request.requestBody">Request Body</v-tab>
                  <v-tab value="response" v-if="request.responseHeaders">Response</v-tab>
                  <v-tab value="capture">Variable Capture</v-tab>
                </v-tabs>
                
                <v-card-text>
                  <v-window v-model="activeTab">
                    <v-window-item value="headers">
                      <pre>{{ formatHeaders(request.requestHeaders) }}</pre>
                    </v-window-item>
                    
                    <v-window-item value="body" v-if="request.requestBody">
                      <pre>{{ formatBody(request.requestBody) }}</pre>
                    </v-window-item>
                    
                    <v-window-item value="response" v-if="request.responseHeaders">
                      <pre>{{ formatHeaders(request.responseHeaders) }}</pre>
                    </v-window-item>
                    
                    <v-window-item value="capture">
                      <variable-capture-form 
                        :request="request" 
                        @add-capture="addVariableCapture"
                        @update-request="updateRequest(index, $event)"
                      />
                    </v-window-item>
                  </v-window>
                </v-card-text>
              </v-card>
            </div>
          </v-expand-transition>
        </v-list-item>
      </v-list>
    </v-card>
    
    <!-- Empty state -->
    <v-card v-else class="d-flex align-center justify-center py-12 px-6 text-center" height="200">
      <div>
        <v-icon icon="mdi-information-outline" size="large" color="grey-lighten-1" class="mb-4"></v-icon>
        <div class="text-h6 mb-2">No requests recorded yet</div>
        <div class="text-body-2 text-grey">Click "Start Recording" to begin capturing HTTP requests.</div>
      </div>
    </v-card>
  </div>
</template>

<script>
import RecordControls from './RecordControls.vue';
import VariableCaptureForm from './VariableCaptureForm.vue';
import recordService from '../../services/recordService';
import { isRestrictedUrl } from '../../utils/chromeApi';

export default {
  name: 'RecordTab',
  components: {
    RecordControls,
    VariableCaptureForm
  },
  data() {
    return {
      isRecording: false,
      recordingStatus: 'Ready to record',
      recordedRequests: [],
      recordedCount: 0,
      expandedRequest: null,
      activeTab: null,
      restrictedUrlWarning: false,
      activeTabId: null,
      activeTabUrl: '',
      contentScriptReady: false,
      isOpeningReplayTab: false, // Add this flag to prevent multiple clicks
    }
  },
  computed: {
    hasRecordedData() {
      return this.recordedRequests && this.recordedRequests.length > 0;
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
    
    // Check current page compatibility
    this.checkCurrentPageCompatibility();
  },
  beforeUnmount() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  },
  methods: {
    async checkRecordingStatus() {
      const response = await recordService.getRecordingStatus();
      if (response && response.isRecording) {
        this.isRecording = true;
        this.recordingStatus = 'Recording active...';
        this.recordedCount = response.requestCount || 0;
      }
    },
    
    async updateRecordingStatus() {
      const response = await recordService.getRecordingStatus();
      if (response) {
        this.recordedCount = response.requestCount || 0;
      }
    },
    
    async toggleRecording() {
      if (this.restrictedUrlWarning) {
        this.recordingStatus = 'Cannot record from this page type';
        return;
      }

      try {
        if (!this.isRecording) {
          // Show immediate feedback to user
          this.recordingStatus = 'Initializing recording...';
          
          // Start recording
          const response = await recordService.startRecording();
          
          if (response && response.status && !response.error) {
            this.isRecording = true;
            this.recordingStatus = 'Recording active...';
          } else {
            this.recordingStatus = `Error: ${response.error || 'Failed to start recording'}`;
          }
        } else {
          // Stop recording
          this.recordingStatus = 'Stopping recording...';
          const response = await recordService.stopRecording();
          
          if (response) {
            // Set the recordedRequests to the data array, even if empty
            this.recordedRequests = response.data || [];
            this.isRecording = false;
            
            if (response.status === 'error') {
              this.recordingStatus = `Error: ${response.error || 'Unknown error'}`;
              console.error('Error stopping recording:', response.error);
            } else if (response.status === 'warning') {
              this.recordingStatus = `Warning: ${response.message || 'Recording stopped with warnings'}`;
              console.warn('Warning when stopping recording:', response.message);
            } else {
              this.recordingStatus = 'Recording stopped';
            }
          } else {
            this.isRecording = false;
            this.recordingStatus = 'Recording stopped with issues';
            console.error('Error stopping recording: Empty response');
          }
        }
      } catch (error) {
        this.recordingStatus = 'Error while recording';
        console.error('Recording error:', error);
      }
    },
    
    async exportRecording() {
      try {
        await recordService.exportAsOpenAPI(this.recordedRequests);
      } catch (error) {
        console.error('Error exporting recording:', error);
        this.recordingStatus = `Export error: ${error.message}`;
      }
    },
    
    clearRecordings() {
      this.recordedRequests = [];
      this.recordingStatus = 'Data cleared';
    },
    
    toggleDetails(index) {
      this.expandedRequest = this.expandedRequest === index ? null : index;
    },
    
    updateRequest(index, updatedRequest) {
      this.recordedRequests[index] = updatedRequest;
      // Create a new array to trigger reactivity
      this.recordedRequests = [...this.recordedRequests];
    },
    
    async openReplayInNewTab() {
      if (this.isOpeningReplayTab) return; // Prevent multiple clicks
      
      this.isOpeningReplayTab = true;
      try {
        // Even if there are no requests, open the replay tab anyway
        // The user can then import a file if needed
        const response = await recordService.openReplayInNewTab(this.recordedRequests || []);
        if (!response || !response.success) {
          console.error('Error opening replay tab:', response?.error);
          this.recordingStatus = `Error: ${response?.error || 'Failed to open replay tab'}`;
        }
      } catch (error) {
        console.error('Error opening replay tab:', error);
        this.recordingStatus = `Error opening replay tab: ${error.message || 'Unknown error'}`;
      } finally {
        this.isOpeningReplayTab = false;
      }
    },
    
    async checkCurrentPageCompatibility() {
      try {
        // Get active tab info
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tabs || !tabs.length) return;
        
        const activeTab = tabs[0];
        this.activeTabId = activeTab.id;
        this.activeTabUrl = activeTab.url || '';
        
        // Check if it's a restricted URL
        this.restrictedUrlWarning = isRestrictedUrl(this.activeTabUrl);
        
        if (this.restrictedUrlWarning) {
          this.recordingStatus = 'Recording not available on this page';
        }
      } catch (error) {
        console.error('Error checking page compatibility:', error);
      }
    },
    
    getMethodColor(method) {
      const colors = {
        GET: 'primary',
        POST: 'success',
        PUT: 'warning',
        DELETE: 'error',
        PATCH: 'info'
      };
      return colors[method] || 'grey';
    },
    
    getStatusColor(status) {
      const statusNum = parseInt(status);
      if (statusNum >= 200 && statusNum < 300) return 'success';
      if (statusNum >= 300 && statusNum < 400) return 'info';
      if (statusNum >= 400 && statusNum < 500) return 'warning';
      if (statusNum >= 500) return 'error';
      return 'grey';
    },
    
    addVariableCapture(captureConfig) {
      const index = this.expandedRequest;
      if (index === null) return;
      
      if (!this.recordedRequests[index].variableCapture) {
        this.recordedRequests[index].variableCapture = [];
      }
      
      this.recordedRequests[index].variableCapture.push(captureConfig);
      this.recordedRequests = [...this.recordedRequests];
    },
    
    showError(message) {
      this.recordingStatus = message;
      console.error(message);
    }
  }
}
</script>

<style scoped>
.record-tab {
  width: 100%;
}

.rotate-icon {
  transform: rotate(180deg);
}

pre {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  max-height: 250px;
  font-size: 12px;
  font-family: 'Courier New', Courier, monospace;
}
</style>
