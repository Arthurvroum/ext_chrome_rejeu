<template>
  <div class="replay-tab">
    <div class="header">
      <h1>Network Request Replay</h1>
      <div class="execution-status" :class="executionStatusClass">
        {{ executionStatus }}
      </div>
    </div>
    
    <div class="file-input" v-if="!autoLoadedData">
      <label for="scenario-file">Load Scenario (OpenAPI 3.0):</label>
      <input type="file" id="scenario-file" @change="loadScenarioFile" accept=".json">
    </div>
    
    <div v-if="scenario || recordedRequestsData" class="scenario-config">
      <h3>{{ (scenario?.info?.title) || 'Recently Recorded Scenario' }}</h3>
      <p>{{ (scenario?.info?.description) || 'This is your recently recorded scenario ready for replay.' }}</p>
      
      <div class="execution-options">
        <h4>Execution Options</h4>
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="executionOptions.stopOnError">
            Stop on First Error
          </label>
        </div>
      </div>
      
      <div class="scenario-steps">
        <h4>Steps</h4>
        <div class="step-controls">
          <button @click="toggleAllSteps(false)" class="toggle-btn">Skip All</button>
          <button @click="toggleAllSteps(true)" class="toggle-btn">Enable All</button>
        </div>
        <div 
          v-for="(step, index) in scenarioSteps" 
          :key="index"
          class="step-item"
        >
          <div class="step-header">
            <label class="step-checkbox">
              <input type="checkbox" v-model="step.enabled" :checked="!step.skip">
              {{ step.skip ? 'Skipped' : 'Enabled' }}
            </label>
            <span class="step-name">{{ step.name || `Step ${index + 1}` }}</span>
            <span class="step-method">{{ step.method }}</span>
            <span class="step-url">{{ step.url }}</span>
          </div>
          
          <div class="step-details" v-if="expandedStep === index">
            <div class="variable-substitutions" v-if="step.variableSubstitutions && step.variableSubstitutions.length">
              <h5>Variable Substitutions</h5>
              <div v-for="(sub, subIndex) in step.variableSubstitutions" :key="`sub-${subIndex}`" class="substitution-item">
                <div class="form-group">
                  <label>Target: {{ sub.target }}</label>
                  <input type="text" v-model="sub.value" :placeholder="sub.description">
                </div>
              </div>
            </div>
            
            <div class="variable-captures" v-if="step.variableCaptures && step.variableCaptures.length">
              <h5>Variable Captures</h5>
              <div v-for="(cap, capIndex) in step.variableCaptures" :key="`cap-${capIndex}`" class="capture-item">
                <p>{{ cap.name }}: {{ cap.description }}</p>
                <p>Pattern: {{ cap.regex }}</p>
                <p>Required: {{ cap.required ? 'Yes' : 'No' }}</p>
              </div>
            </div>
          </div>
          
          <button class="toggle-details" @click="toggleStepDetails(index)">
            {{ expandedStep === index ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>
      </div>
      
      <div class="replay-controls">
        <button @click="startReplay" :disabled="isReplaying" class="primary-btn">
          {{ isReplaying ? 'Replaying...' : 'Start Replay' }}
        </button>
        <button @click="clearResults" :disabled="!replayResults || !replayResults.length">Clear Results</button>
      </div>
      
      <div class="replay-results" v-if="replayResults && replayResults.length">
        <h4>Replay Results</h4>
        <div 
          v-for="(result, index) in replayResults" 
          :key="`result-${index}`"
          class="result-item"
          :class="{ 'success': result.status === 'success', 'error': result.status === 'error', 'skipped': result.status === 'skipped' }"
        >
          <div class="result-header">
            <span class="result-step">{{ result.step }}</span>
            <span class="result-status">{{ result.status }}</span>
          </div>
          
          <div class="result-details" v-if="expandedResult === index">
            <div v-if="result.status === 'error'">
              <h5>Error</h5>
              <pre>{{ result.error }}</pre>
            </div>
            
            <div v-if="result.status === 'success'">
              <div class="detail-section">
                <h5>Request</h5>
                <pre>{{ formatJson(result.request) }}</pre>
              </div>
              
              <div class="detail-section">
                <h5>Response</h5>
                <pre>{{ formatJson(result.response) }}</pre>
              </div>
              
              <div class="detail-section" v-if="result.capturedVariables && Object.keys(result.capturedVariables).length">
                <h5>Captured Variables</h5>
                <pre>{{ formatJson(result.capturedVariables) }}</pre>
              </div>
            </div>
          </div>
          
          <button class="toggle-details" @click="toggleResultDetails(index)">
            {{ expandedResult === index ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>
      </div>
      
      <div class="export-section" v-if="replayResults && replayResults.length">
        <button @click="exportReplayResults">Export Results</button>
        <button @click="generatePdfReport">Generate PDF Report</button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <p>No scenario loaded. Please load an OpenAPI 3.0 file to get started.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReplayTab',
  data() {
    return {
      scenario: null,
      scenarioSteps: [],
      expandedStep: null,
      expandedResult: null,
      isReplaying: false,
      replayResults: [],
      executionOptions: {
        stopOnError: true,
      },
      recordedRequestsData: null,
      autoLoadedData: false
    }
  },
  mounted() {
    // Check if we should auto-load the latest recording
    chrome.storage.local.get(['latestRecordedData', 'autoLoadLatestRecording'], (result) => {
      if (result.autoLoadLatestRecording && result.latestRecordedData) {
        this.recordedRequestsData = result.latestRecordedData;
        this.autoLoadedData = true;
        this.convertRecordedDataToScenario();
        
        // Reset the auto-load flag
        chrome.storage.local.set({ autoLoadLatestRecording: false });
      }
    });
  },
  methods: {
    loadScenarioFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.processScenario(data);
        } catch (error) {
          alert('Error parsing file: ' + error.message);
        }
      };
      reader.readAsText(file);
    },
    
    processScenario(data) {
      // Validate that it's an OpenAPI spec
      if (!data.openapi || !data.paths) {
        alert('Invalid OpenAPI format');
        return;
      }
      
      this.scenario = data;
      this.scenarioSteps = this.extractStepsFromOpenAPI(data);
    },
    
    extractStepsFromOpenAPI(openApiSpec) {
      const steps = [];
      
      // Extract steps from paths
      for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (method === 'parameters' || method === 'summary' || method === 'description') continue;
          
          const step = {
            name: operation.summary || operation.operationId,
            description: operation.description,
            url: path,
            method: method.toUpperCase(),
            skip: false,
            parameters: operation.parameters,
            requestBody: operation.requestBody,
            responses: operation.responses,
            variableSubstitutions: [],
            variableCaptures: []
          };
          
          // Extract variable substitutions from x-variable-substitution extension
          if (operation['x-variable-substitution']) {
            step.variableSubstitutions = operation['x-variable-substitution'];
          }
          
          // Extract variable captures from x-variable-capture extension
          if (operation['x-variable-capture']) {
            step.variableCaptures = operation['x-variable-capture'];
          }
          
          steps.push(step);
        }
      }
      
      return steps;
    },
    
    toggleStepDetails(index) {
      this.expandedStep = this.expandedStep === index ? null : index;
    },
    
    toggleResultDetails(index) {
      this.expandedResult = this.expandedResult === index ? null : index;
    },
    
    convertRecordedDataToScenario() {
      if (!this.recordedRequestsData || !this.recordedRequestsData.length) {
        return;
      }
      
      // Convert recorded data to scenario steps
      this.scenarioSteps = this.recordedRequestsData.map((request, index) => {
        return {
          name: `Request ${index + 1}: ${request.method} ${this.getPathFromUrl(request.url)}`,
          url: request.url,
          method: request.method,
          enabled: true,
          skip: false,
          requestHeaders: request.requestHeaders,
          requestBody: request.requestBody,
          responseHeaders: request.responseHeaders,
          variableSubstitutions: [],
          variableCaptures: request.variableCapture || []
        };
      });
    },
    
    getPathFromUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.pathname;
      } catch (e) {
        return url;
      }
    },
    
    toggleAllSteps(enabled) {
      this.scenarioSteps.forEach(step => {
        step.skip = !enabled;
        step.enabled = enabled;
      });
    },
    
    startReplay() {
      this.isReplaying = true;
      this.replayResults = [];
      
      // Update skip status based on enabled property
      this.scenarioSteps.forEach(step => {
        step.skip = !step.enabled;
      });
      
      // Prepare the scenario for replay
      const replayConfig = {
        options: this.executionOptions,
        steps: this.scenarioSteps.map(step => ({
          ...step,
          // Include only the necessary fields
          name: step.name,
          method: step.method,
          url: step.url,
          skip: step.skip,
          parameters: step.parameters,
          requestBody: step.requestBody,
          variableSubstitutions: step.variableSubstitutions,
          variableCaptures: step.variableCaptures
        }))
      };
      
      // Send message to background script to execute replay
      chrome.runtime.sendMessage(
        { 
          action: 'replayRequests', 
          scenario: replayConfig 
        },
        (response) => {
          this.isReplaying = false;
          
          if (response && response.status === 'Replay completed') {
            this.replayResults = response.results;
          } else {
            alert('Replay failed: ' + (response?.error || 'Unknown error'));
          }
        }
      );
    },
    
    clearResults() {
      this.replayResults = [];
    },
    
    exportReplayResults() {
      const resultData = {
        timestamp: new Date().toISOString(),
        scenario: this.scenario.info.title,
        results: this.replayResults
      };
      
      const blob = new Blob([JSON.stringify(resultData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replay-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    },
    
    generatePdfReport() {
      // In a real implementation, this would generate a PDF report
      // For now, we'll just alert
      alert('PDF generation would be implemented here');
      
      // This would typically:
      // 1. Format the results in a report-friendly way
      // 2. Use a library like jsPDF to generate a PDF
      // 3. Offer it for download
    },
    
    formatJson(data) {
      if (!data) return 'No data available';
      return JSON.stringify(data, null, 2);
    }
  }
}
</script>

<style scoped>
.replay-tab {
  font-family: Arial, sans-serif;
  width: 100%;
  height: 100%;
  margin: 0 auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: auto; /* Allow scrolling */
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
  width: 100%;
  flex-shrink: 0; /* Don't allow to shrink */
}

/* Adjust text sizes */
h1 {
  font-size: 1.4rem;
  font-weight: 700;
  color: #333;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  margin: 0;
}

h3, h4 {
  font-size: 1.1rem;
  margin: 10px 0;
}

/* Full window adjustments */
:global(.full-window) .replay-tab {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

:global(.full-window) .replay-tab h1 {
  font-size: 2.2rem;
}

:global(.full-window) .replay-tab h3, 
:global(.full-window) .replay-tab h4 {
  font-size: 1.6rem;
}

/* File input styling */
.file-input {
  margin-bottom: 15px;
  width: 100%;
  text-align: center;
  flex-shrink: 0; /* Don't allow to shrink */
}

.file-input label {
  display: block;
  margin-bottom: 8px;
  font-size: 1rem;
  font-weight: 600;
}

/* Scenario config container */
.scenario-config {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 10px;
  width: 100%;
  box-shadow: 0 5px 20px rgba(0,0,0,0.1);
  background-color: white;
  display: flex;
  flex-direction: column;
  flex: 1; /* Allow it to grow */
  overflow: auto; /* Enable scrolling */
}

/* Steps container should be scrollable */
.scenario-steps {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  overflow-y: auto; /* Allow vertical scrolling */
  flex: 1; /* Take available space */
}

/* For popup mode - smaller text */
h1 {
  font-size: 1.6rem;
  font-weight: 700;
  color: #333;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
}

h3, h4 {
  font-size: 1.2rem;
  margin: 15px 0;
}

/* For full window mode - larger text */
:global(.full-window) .replay-tab h1 {
  font-size: 2.2rem;
}

:global(.full-window) .replay-tab h3, 
:global(.full-window) .replay-tab h4 {
  font-size: 1.6rem;
}

.file-input {
  margin-bottom: 30px;
  width: 100%;
  text-align: center;
}

.file-input label {
  display: block;
  margin-bottom: 10px;
  font-size: 1.2rem;
  font-weight: 600;
}

.scenario-config {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 15px;
  width: 100%;
  box-shadow: 0 5px 20px rgba(0,0,0,0.1);
  background-color: white;
  flex-grow: 1; /* Fill available space */
  display: flex;
  flex-direction: column;
}

/* Make step list scrollable if needed */
.scenario-steps {
  margin-bottom: 20px;
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.execution-options, .scenario-steps, .replay-results {
  margin-bottom: 30px;
}

.step-item, .result-item {
  border: 1px solid #dee2e6;
  border-radius: 10px;
  margin-bottom: 15px;
  padding: 20px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
}

.step-item:hover, .result-item:hover {
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.step-header, .result-header {
  display: flex;
  align-items: center;
  gap: 15px;
}

.step-name, .result-step {
  font-weight: bold;
  font-size: 1.2rem;
}

.step-method {
  color: #007bff;
  width: 70px;
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
}

.step-url {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.1rem;
}

.step-details, .result-details {
  margin-top: 15px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
}

button {
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 3px 8px rgba(0,0,0,0.1);
  border: none;
}

/* Full window buttons should be larger */
:global(.full-window) .replay-tab button {
  padding: 14px 25px;
  font-size: 1.1rem;
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0,0,0,0.15);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-details {
  background: none;
  color: #007bff;
  padding: 8px 15px;
  margin-top: 15px;
  box-shadow: none;
  text-decoration: underline;
  font-size: 1rem;
}

.toggle-details:hover {
  color: #0056b3;
  background: rgba(0, 123, 255, 0.05);
  border-radius: 5px;
  text-decoration: none;
  transform: none;
  box-shadow: none;
}

.primary-btn {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
  padding: 15px 30px;
  font-size: 1.2rem;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.primary-btn:hover:not(:disabled) {
  background-color: #0069d9;
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.4);
}

.result-item.success {
  border-left: 6px solid #28a745;
}

.result-item.error {
  border-left: 6px solid #dc3545;
}

.result-item.skipped {
  border-left: 6px solid #ffc107;
}
</style>
