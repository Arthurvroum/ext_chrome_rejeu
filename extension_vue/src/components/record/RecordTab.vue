<template>
  <div class="record-tab">
    <div class="content-container">
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
      />
      
      <!-- Replay option -->
      <replay-option
        :show="showReplayOption"
        :request-count="recordedRequests.length"
        @open-replay="openReplayInNewTab"
      />
      
      <!-- URL restriction warning -->
      <warning-message
        v-if="restrictedUrlWarning"
        title="Cannot record from this page"
        message="Recording is not possible on browser internal pages or extension pages. Please navigate to a regular website to use recording features."
      />

      <!-- Request list -->
      <div class="request-list" v-if="hasRecordedData">
        <h3>Recorded Requests ({{ recordedRequests.length }})</h3>
        <request-item
          v-for="(request, index) in recordedRequests"
          :key="index"
          :request="request"
          :expanded="expandedRequest === index"
          @toggle-details="toggleDetails(index)"
          @update-request="updateRequest(index, $event)"
        />
      </div>
      
      <!-- Empty state -->
      <div class="empty-state" v-else>
        <p>No requests recorded yet. Click "Start Recording" to begin capturing HTTP requests.</p>
      </div>
    </div>
  </div>
</template>

<script>
import RecordControls from './RecordControls.vue';
import ReplayOption from './ReplayOption.vue';
import WarningMessage from './WarningMessage.vue';
import RequestItem from './RequestItem.vue';
import recordService from '../../services/recordService';
import { isRestrictedUrl } from '../../utils/chromeApi';

export default {
  name: 'RecordTab',
  components: {
    RecordControls,
    ReplayOption,
    WarningMessage,
    RequestItem
  },
  data() {
    return {
      isRecording: false,
      recordingStatus: 'Ready to record',
      recordedRequests: [],
      recordedCount: 0,
      expandedRequest: null,
      showReplayOption: false,
      restrictedUrlWarning: false,
      activeTabId: null,
      activeTabUrl: '',
      contentScriptReady: false
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
            this.showReplayOption = false;
          } else {
            this.recordingStatus = `Error: ${response.error || 'Failed to start recording'}`;
          }
        } else {
          // Stop recording
          const response = await recordService.stopRecording();
          
          if (response && response.status) {
            this.isRecording = false;
            this.recordingStatus = 'Recording stopped';
            this.recordedRequests = response.data || [];
            
            // Show replay option if we have recorded data
            if (this.recordedRequests.length > 0) {
              this.showReplayOption = true;
            }
          } else {
            this.recordingStatus = `Error: ${response.error || 'Failed to stop recording'}`;
          }
        }
      } catch (error) {
        console.error('Error toggling recording:', error);
        this.recordingStatus = `Error: ${error.message}`;
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
      this.showReplayOption = false;
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
      try {
        this.recordingStatus = 'Opening replay tab...';
        const response = await recordService.openReplayInNewTab(this.recordedRequests);
        
        if (!response || !response.success) {
          this.recordingStatus = 'Error opening replay tab';
        }
      } catch (error) {
        console.error('Error opening replay tab:', error);
        this.recordingStatus = `Error opening replay tab: ${error.message}`;
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
  overflow: auto;
  flex: 1;
  align-items: center;
  box-sizing: border-box;
}

.content-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
}

/* For full window mode, ensure proper spacing */
:global(.full-window) .record-tab {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.request-list {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 15px;
}

h3 {
  margin: 15px 0;
  font-size: 1.2rem;
  color: #495057;
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-top: 20px;
}
</style>
