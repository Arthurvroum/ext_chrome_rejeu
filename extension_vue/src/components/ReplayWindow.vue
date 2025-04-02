<template>
  <div class="replay-window">
    <div class="header">
      <h1>Network Request Replay</h1>
      <div class="execution-status" :class="executionStatusClass">
        {{ executionStatus }}
      </div>
    </div>
    
    <div class="config-panel">
      <div class="execution-options">
        <label>
          <input type="checkbox" v-model="stopOnError">
          Stop on Error
        </label>
        <button @click="startReplay" :disabled="isReplaying" class="start-button">
          Start Replay
        </button>
        <button @click="stopReplay" :disabled="!isReplaying" class="stop-button">
          Stop Replay
        </button>
      </div>
      
      <div class="filter-options">
        <label>
          <input type="checkbox" v-model="showSuccessful">
          Show Successful
        </label>
        <label>
          <input type="checkbox" v-model="showFailed">
          Show Failed
        </label>
        <label>
          <input type="checkbox" v-model="showPending">
          Show Pending
        </label>
      </div>
    </div>
    
    <div class="steps-container">
      <h2>Replay Steps
        <button @click="toggleAllSteps(true)" class="toggle-button">Enable All</button>
        <button @click="toggleAllSteps(false)" class="toggle-button">Skip All</button>
      </h2>
      
      <div class="steps-list">
        <div 
          v-for="(step, index) in replaySteps" 
          :key="index"
          class="step-item"
          :class="{ 
            'pending': step.status === 'pending',
            'in-progress': step.status === 'in-progress',
            'success': step.status === 'success',
            'skipped': step.status === 'skipped',
            'error': step.status === 'error',
            'disabled': step.skip
          }"
        >
          <div class="step-header">
            <div class="step-control">
              <input 
                type="checkbox" 
                :id="`step-${index}`" 
                v-model="step.enabled"
                @change="updateStepSkipStatus(index)"
              >
              <label :for="`step-${index}`" class="step-number">{{ index + 1 }}</label>
            </div>
            
            <div class="step-info">
              <div class="step-name">{{ step.name || `Request ${index + 1}` }}</div>
              <div class="step-method-url">
                <span class="step-method">{{ step.method }}</span>
                <span class="step-url">{{ step.url }}</span>
              </div>
            </div>
            
            <div class="step-status-indicator">
              <span v-if="step.status === 'pending'" class="status pending">Pending</span>
              <span v-else-if="step.status === 'in-progress'" class="status in-progress">Running...</span>
              <span v-else-if="step.status === 'success'" class="status success">Success</span>
              <span v-else-if="step.status === 'error'" class="status error">Failed</span>
              <span v-else-if="step.status === 'skipped'" class="status skipped">Skipped</span>
            </div>
          </div>
          
          <div class="step-details" v-if="step.expanded || step.status === 'in-progress' || step.status === 'error'">
            <div class="request-details" v-if="step.requestData">
              <h4>Request</h4>
              <div class="detail-group">
                <div class="detail-label">URL:</div>
                <div class="detail-value">{{ step.requestData.url }}</div>
              </div>
              <div class="detail-group">
                <div class="detail-label">Method:</div>
                <div class="detail-value">{{ step.requestData.method }}</div>
              </div>
              <div class="detail-group" v-if="step.requestData.headers">
                <div class="detail-label">Headers:</div>
                <pre class="detail-value">{{ formatJson(step.requestData.headers) }}</pre>
              </div>
              <div class="detail-group" v-if="step.requestData.body">
                <div class="detail-label">Body:</div>
                <pre class="detail-value">{{ formatJson(step.requestData.body) }}</pre>
              </div>
            </div>
            
            <div class="response-details" v-if="step.responseData">
              <h4>Response</h4>
              <div class="detail-group">
                <div class="detail-label">Status:</div>
                <div class="detail-value" :class="{'error-text': !isSuccessStatus(step.responseData.status)}">
                  {{ step.responseData.status }} {{ step.responseData.statusText }}
                </div>
              </div>
              <div class="detail-group" v-if="step.responseData.headers">
                <div class="detail-label">Headers:</div>
                <pre class="detail-value">{{ formatJson(step.responseData.headers) }}</pre>
              </div>
              <div class="detail-group" v-if="step.responseData.body">
                <div class="detail-label">Body:</div>
                <pre class="detail-value">{{ formatJson(step.responseData.body) }}</pre>
              </div>
            </div>
            
            <div class="variables-captured" v-if="step.capturedVariables && Object.keys(step.capturedVariables).length > 0">
              <h4>Variables Captured</h4>
              <div class="variables-list">
                <div v-for="(value, name) in step.capturedVariables" :key="name" class="variable-item">
                  <div class="variable-name">{{ name }}:</div>
                  <div class="variable-value">{{ value }}</div>
                </div>
              </div>
            </div>
            
            <div class="error-details" v-if="step.error">
              <h4>Error</h4>
              <pre class="error-message">{{ step.error }}</pre>
            </div>
          </div>
          
          <div class="step-actions">
            <button @click="toggleStepDetails(index)" class="toggle-details">
              {{ step.expanded ? 'Hide Details' : 'Show Details' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="execution-summary" v-if="executionComplete">
      <h2>Execution Summary</h2>
      <div class="summary-stats">
        <div class="stat-item">
          <div class="stat-value">{{ totalSteps }}</div>
          <div class="stat-label">Total Steps</div>
        </div>
        <div class="stat-item success">
          <div class="stat-value">{{ successfulSteps }}</div>
          <div class="stat-label">Successful</div>
        </div>
        <div class="stat-item error">
          <div class="stat-value">{{ failedSteps }}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-item skipped">
          <div class="stat-value">{{ skippedSteps }}</div>
          <div class="stat-label">Skipped</div>
        </div>
      </div>
      
      <div class="execution-actions">
        <button @click="exportResults" class="export-button">Export Results</button>
        <button @click="generatePdfReport" class="pdf-button">Generate PDF Report</button>
      </div>
    </div>
  </div>
</template>

<script>
/* eslint-disable */
export default {
  name: 'ReplayWindow',
  data() {
    return {
      replaySteps: [],
      isReplaying: false,
      executionStatus: 'Ready to start',
      executionComplete: false,
      stopOnError: true,
      showSuccessful: true,
      showFailed: true,
      showPending: true,
      currentStepIndex: -1,
      progressPollingInterval: null
    };
  },
  computed: {
    executionStatusClass() {
      if (this.executionStatus.includes('Error') || this.executionStatus.includes('Failed')) {
        return 'error';
      } else if (this.executionStatus.includes('Complete')) {
        return 'success';
      } else if (this.executionStatus.includes('Running')) {
        return 'in-progress';
      }
      return '';
    },
    totalSteps() {
      return this.replaySteps.length;
    },
    successfulSteps() {
      return this.replaySteps.filter(step => step.status === 'success').length;
    },
    failedSteps() {
      return this.replaySteps.filter(step => step.status === 'error').length;
    },
    skippedSteps() {
      return this.replaySteps.filter(step => step.status === 'skipped').length;
    },
    filteredSteps() {
      return this.replaySteps.filter(step => {
        if (step.status === 'success' && !this.showSuccessful) return false;
        if (step.status === 'error' && !this.showFailed) return false;
        if ((step.status === 'pending' || step.status === 'in-progress') && !this.showPending) return false;
        return true;
      });
    }
  },
  mounted() {
    this.loadReplayData();
    
    // Listen for replay progress updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'replayProgressUpdated') {
        this.updateProgressFromMessage(message.data);
        sendResponse({ received: true });
      }
      return true;
    });
    
    // Start polling for progress updates
    this.progressPollingInterval = setInterval(this.checkProgressUpdates, 500);
  },
  beforeUnmount() {
    // Clean up interval when component is destroyed
    if (this.progressPollingInterval) {
      clearInterval(this.progressPollingInterval);
    }
  },
  methods: {
    loadReplayData() {
      chrome.storage.local.get(['replayWindowData', 'isLiveReplay'], (result) => {
        if (result.replayWindowData) {
          // Initialize steps with status
          this.replaySteps = result.replayWindowData.map(step => ({
            ...step,
            status: 'pending',
            expanded: false,
            enabled: !step.skip,
            requestData: null,
            responseData: null,
            capturedVariables: {},
            error: null
          }));
        }
      });
    },
    
    updateProgressFromMessage(progressData) {
      if (!progressData || !progressData.stepIndex) return;
      
      // Modify this line to avoid unused variable warning
      const { stepIndex, status, request } = progressData;
      const response = progressData.response;
      const variables = progressData.variables;
      const error = progressData.error;
      
      if (stepIndex >= 0 && stepIndex < this.replaySteps.length) {
        // Update the step's status
        this.replaySteps[stepIndex].status = status;
        
        if (request) this.replaySteps[stepIndex].requestData = request;
        if (response) this.replaySteps[stepIndex].responseData = response;
        if (variables) this.replaySteps[stepIndex].capturedVariables = variables;
        if (error) this.replaySteps[stepIndex].error = error;
        
        // Auto-expand the current step
        this.replaySteps[stepIndex].expanded = true;
        
        // Update overall status
        if (status === 'in-progress') {
          this.currentStepIndex = stepIndex;
          this.executionStatus = `Running step ${stepIndex + 1} of ${this.replaySteps.length}`;
        } else if (status === 'complete') {
          this.executionComplete = true;
          this.isReplaying = false;
          this.executionStatus = 'Execution Complete';
        } else if (status === 'error' && this.stopOnError) {
          this.isReplaying = false;
          this.executionStatus = 'Execution Failed';
        }
      }
    },
    
    checkProgressUpdates() {
      chrome.storage.local.get(['replayProgress', 'replayProgressTimestamp'], (result) => {
        // Only update if there's recent progress data
        if (result.replayProgress && result.replayProgressTimestamp) {
          // Check if data is recent (last 10 seconds)
          const now = Date.now();
          const dataAge = now - result.replayProgressTimestamp;
          
          if (dataAge < 10000) {
            this.updateProgressFromMessage(result.replayProgress);
          }
        }
      });
    },
    
    startReplay() {
      this.isReplaying = true;
      this.executionStatus = 'Running replay...';
      this.executionComplete = false;
      
      // Update all steps to use the latest enabled/skip status
      const stepsToExecute = this.replaySteps.map(step => ({
        ...step,
        skip: !step.enabled,
        status: 'pending',
        expanded: false,
        requestData: null,
        responseData: null,
        capturedVariables: {},
        error: null
      }));
      
      // Send message to background script to start replay
      chrome.runtime.sendMessage({
        action: 'startReplayWithTracking',
        steps: stepsToExecute,
        options: {
          stopOnError: this.stopOnError
        }
      }, (response) => {
        if (!response || !response.success) {
          this.executionStatus = 'Failed to start replay';
          this.isReplaying = false;
        }
      });
    },
    
    stopReplay() {
      chrome.runtime.sendMessage({ action: 'stopReplay' }, (response) => {
        this.isReplaying = false;
        this.executionStatus = 'Replay stopped manually';
      });
    },
    
    toggleAllSteps(enabled) {
      this.replaySteps.forEach(step => {
        step.enabled = enabled;
        step.skip = !enabled;
      });
    },
    
    updateStepSkipStatus(index) {
      if (index >= 0 && index < this.replaySteps.length) {
        this.replaySteps[index].skip = !this.replaySteps[index].enabled;
      }
    },
    
    toggleStepDetails(index) {
      if (index >= 0 && index < this.replaySteps.length) {
        this.replaySteps[index].expanded = !this.replaySteps[index].expanded;
      }
    },
    
    formatJson(data) {
      if (!data) return 'No data available';
      
      try {
        if (typeof data === 'object') {
          return JSON.stringify(data, null, 2);
        } else if (typeof data === 'string') {
          // Try to parse as JSON if it's a string
          const parsed = JSON.parse(data);
          return JSON.stringify(parsed, null, 2);
        }
        return String(data);
      } catch (e) {
        return String(data);
      }
    },
    
    isSuccessStatus(status) {
      return status >= 200 && status < 300;
    },
    
    exportResults() {
      const resultData = {
        timestamp: new Date().toISOString(),
        steps: this.replaySteps.map(step => ({
          name: step.name,
          url: step.url,
          method: step.method,
          status: step.status,
          response: step.responseData,
          variables: step.capturedVariables,
          error: step.error
        }))
      };
      
      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(resultData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replay-results-${new Date().toISOString().replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    
    generatePdfReport() {
      // This would generate a PDF report
      alert('PDF generation would be implemented here');
    }
  }
}
/* eslint-enable */
</script>

<style scoped>
.replay-window {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h1, h2, h4 {
  margin: 0;
  color: #333;
}

.execution-status {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  background-color: #f0f0f0;
}

.execution-status.success {
  background-color: #d4edda;
  color: #155724;
}

.execution-status.error {
  background-color: #f8d7da;
  color: #721c24;
}

.execution-status.in-progress {
  background-color: #cce5ff;
  color: #004085;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.config-panel {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.execution-options, .filter-options {
  display: flex;
  gap: 15px;
  align-items: center;
}

.steps-container {
  margin-bottom: 30px;
}

.steps-container h2 {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.toggle-button {
  margin-left: 15px;
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 4px;
  background-color: #e9ecef;
  border: 1px solid #ced4da;
  cursor: pointer;
}

.steps-list {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.step-item {
  padding: 15px;
  border-bottom: 1px solid #dee2e6;
  background-color: #fff;
}

.step-item:last-child {
  border-bottom: none;
}

.step-item.success {
  border-left: 5px solid #28a745;
}

.step-item.error {
  border-left: 5px solid #dc3545;
}

.step-item.in-progress {
  border-left: 5px solid #007bff;
  background-color: #f8f9fa;
}

.step-item.pending {
  border-left: 5px solid #6c757d;
}

.step-item.skipped {
  border-left: 5px solid #ffc107;
  opacity: 0.7;
}

.step-item.disabled {
  opacity: 0.5;
  background-color: #f8f9fa;
}

.step-header {
  display: flex;
  align-items: center;
}

.step-control {
  display: flex;
  align-items: center;
  margin-right: 15px;
}

.step-number {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  border-radius: 50%;
  margin-left: 10px;
  font-weight: bold;
}

.step-info {
  flex: 1;
}

.step-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.step-method-url {
  display: flex;
  font-size: 14px;
  color: #6c757d;
}

.step-method {
  font-weight: bold;
  color: #007bff;
  margin-right: 10px;
}

.step-status-indicator {
  margin-left: 15px;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status.pending {
  background-color: #e9ecef;
  color: #6c757d;
}

.status.in-progress {
  background-color: #cce5ff;
  color: #004085;
  animation: pulse 1.5s infinite;
}

.status.success {
  background-color: #d4edda;
  color: #155724;
}

.status.error {
  background-color: #f8d7da;
  color: #721c24;
}

.status.skipped {
  background-color: #fff3cd;
  color: #856404;
}

.step-details {
  margin-top: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 20px;
}

.step-details h4 {
  margin-bottom: 10px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 5px;
}

.detail-group {
  margin-bottom: 10px;
}

.detail-label {
  font-weight: bold;
  margin-bottom: 5px;
  color: #495057;
}

.detail-value {
  word-break: break-word;
}

pre {
  background-color: #f1f1f1;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 200px;
  font-size: 12px;
  margin: 0;
}

.error-text {
  color: #dc3545;
}

.variables-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.variable-item {
  display: flex;
  padding: 5px;
  background-color: #fff;
  border-radius: 4px;
}

.variable-name {
  font-weight: bold;
  margin-right: 10px;
  color: #007bff;
}

.error-message {
  color: #dc3545;
  background-color: #f8d7da;
}

.step-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.toggle-details {
  background: none;
  border: none;
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.execution-summary {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
}

.stat-item {
  text-align: center;
  padding: 15px;
  background-color: #fff;
  border-radius: 8px;
  min-width: 100px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  color: #6c757d;
}

.stat-item.success .stat-value {
  color: #28a745;
}

.stat-item.error .stat-value {
  color: #dc3545;
}

.stat-item.skipped .stat-value {
  color: #ffc107;
}

.execution-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

button {
  padding: 10px 15px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-button {
  background-color: #28a745;
  color: white;
}

.start-button:hover:not(:disabled) {
  background-color: #218838;
}

.stop-button {
  background-color: #dc3545;
  color: white;
}

.stop-button:hover:not(:disabled) {
  background-color: #c82333;
}

.export-button, .pdf-button {
  background-color: #007bff;
  color: white;
}

.export-button:hover, .pdf-button:hover {
  background-color: #0069d9;
}
</style>
