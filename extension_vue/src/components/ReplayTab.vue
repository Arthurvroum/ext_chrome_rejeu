<template>
  <div class="replay-tab">
    <!-- Add a container to center content within the full width -->
    <div class="content-container">
      <!-- Existing content -->
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
      
      <!-- Add this Clear All Data button at the top -->
      <div class="clear-all-container">
        <button @click="clearAllReplayData" class="clear-all-btn">
          Clear All Replay Data
        </button>
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
    console.log('ReplayTab mounted, checking for data...');
    
    // Add diagnostic output to help troubleshoot
    this.dumpStorageContents();
    
    // More robust data loading with multiple sources and fallbacks
    chrome.storage.local.get([
      'latestRecordedData', 
      'autoLoadLatestRecording', 
      'replayWindowData', 
      'replayWindowDataCount'
    ], (result) => {
      console.log('Storage data check:', {
        autoLoad: result.autoLoadLatestRecording,
        latestRecordedCount: result.latestRecordedData?.length || 0,
        replayWindowCount: result.replayWindowData?.length || 0,
        countMetadata: result.replayWindowDataCount || 0
      });
      
      // Check URL parameters for state data (emergency fallback)
      const urlParams = new URLSearchParams(window.location.search);
      const stateParam = urlParams.get('state');
      if (stateParam) {
        try {
          const state = JSON.parse(decodeURIComponent(stateParam));
          console.log('Found state param in URL:', state);
          if (state.directData) {
            // This is just diagnostic info - actual data still comes from storage
            console.log('URL indicates direct data transfer was attempted');
          }
        } catch (e) {
          console.error('Error parsing state param:', e);
        }
      }
      
      // First try to load data from replayWindowData (passed directly)
      if (result.replayWindowData && result.replayWindowData.length > 0) {
        console.log('Loading data from replayWindowData:', result.replayWindowData.length, 'requests');
        this.recordedRequestsData = result.replayWindowData;
        this.autoLoadedData = true;
        this.convertRecordedDataToScenario();
        return;
      }
      
      // Then try loading from latestRecordedData
      if (result.latestRecordedData && result.latestRecordedData.length > 0) {
        console.log('Loading data from latestRecordedData:', result.latestRecordedData.length, 'requests');
        this.recordedRequestsData = result.latestRecordedData;
        this.autoLoadedData = true;
        this.convertRecordedDataToScenario();
        
        // Reset the auto-load flag to prevent reloading on refresh only if specifically set
        if (result.autoLoadLatestRecording) {
          chrome.storage.local.set({ autoLoadLatestRecording: false });
        }
      } else {
        console.log('No data to auto-load');
        // Show a message to the user
        this.showNoDataMessage();
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
        console.warn('No recorded data to convert to scenario');
        return;
      }
      
      console.log('Converting', this.recordedRequestsData.length, 'recorded requests to scenario steps');
      
      // Convert recorded data to scenario steps with validation
      this.scenarioSteps = this.recordedRequestsData.map((request, index) => {
        // Ensure the URL is valid
        let path = '(unknown path)';
        try {
          const url = request.url || '';
          path = this.getPathFromUrl(url);
        } catch (e) {
          console.warn('Error parsing URL:', e);
        }
        
        return {
          name: `Request ${index + 1}: ${request.method || 'GET'} ${path}`,
          url: request.url || '',
          method: request.method || 'GET',
          enabled: true,
          skip: false,
          requestHeaders: request.requestHeaders || {},
          requestBody: request.requestBody || null,
          responseHeaders: request.responseHeaders || {},
          variableSubstitutions: [],
          variableCaptures: request.variableCapture || []
        };
      });
      
      console.log('Converted to', this.scenarioSteps.length, 'scenario steps');
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
      // First clear any previous results
      this.clearResults();
      
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
      // Clear the local results array
      this.replayResults = [];
      
      // Also clear any stored replay progress data
      chrome.storage.local.remove([
        'replayProgress', 
        'replayProgressTimestamp'
      ], () => {
        console.log('Previous replay results cleared');
      });
    },
    
    exportReplayResults() {
      const resultData = {
        timestamp: new Date().toISOString(),
        scenario: this.scenario ? this.scenario.info.title : 'Recorded Requests Replay',
        description: this.scenario ? this.scenario.info.description : 'Replay of recorded network requests',
        executionOptions: this.executionOptions,
        results: this.replayResults,
        summary: {
          totalSteps: this.replayResults.length,
          successCount: this.replayResults.filter(r => r.status === 'success').length,
          errorCount: this.replayResults.filter(r => r.status === 'error').length,
          skippedCount: this.replayResults.filter(r => r.status === 'skipped').length
        }
      };
      
      const blob = new Blob([JSON.stringify(resultData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replay-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      
      // Cleanup approach to avoid memory leaks
      a.onclick = () => {
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 150);
      };
      
      a.click();
    },
    
    generatePdfReport() {
      try {
        // Import jsPDF dynamically if not already loaded
        import('jspdf').then(({ jsPDF }) => {
          import('jspdf-autotable').then(() => {
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(20);
            doc.setTextColor(0, 51, 102);
            doc.text('Network Request Replay Results', 14, 20);
            
            // Add timestamp
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
            
            // Add scenario info
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Scenario: ${this.scenario ? this.scenario.info.title : 'Recorded Requests Replay'}`, 14, 40);
            if (this.scenario && this.scenario.info.description) {
              doc.setFontSize(10);
              doc.text(`Description: ${this.scenario.info.description}`, 14, 47);
            }
            
            // Add summary section
            doc.setFontSize(14);
            doc.setTextColor(0, 51, 102);
            doc.text('Execution Summary', 14, 60);
            
            const successCount = this.replayResults.filter(r => r.status === 'success').length;
            const errorCount = this.replayResults.filter(r => r.status === 'error').length;
            const skippedCount = this.replayResults.filter(r => r.status === 'skipped').length;
            
            // Summary table
            doc.autoTable({
              startY: 65,
              head: [['Metric', 'Value']],
              body: [
                ['Total Steps', this.replayResults.length.toString()],
                ['Successful', successCount.toString()],
                ['Failed', errorCount.toString()],
                ['Skipped', skippedCount.toString()],
                ['Success Rate', `${this.replayResults.length ? Math.round((successCount / this.replayResults.length) * 100) : 0}%`]
              ],
              theme: 'grid',
              headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
              styles: { overflow: 'linebreak' },
            });
            
            // Add results section
            let yPos = doc.autoTable.previous.finalY + 15;
            doc.setFontSize(14);
            doc.setTextColor(0, 51, 102);
            doc.text('Detailed Results', 14, yPos);
            
            // Results table
            const resultRows = this.replayResults.map((result, index) => {
              return [
                (index + 1).toString(),
                result.step,
                result.status.toUpperCase(),
                result.status === 'error' ? (result.error || 'Error occurred') : 'OK'
              ];
            });
            
            // If multiple pages needed, ensure good layout
            doc.autoTable({
              startY: yPos + 5,
              head: [['#', 'Step', 'Status', 'Details']],
              body: resultRows,
              theme: 'grid',
              headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
              styles: { overflow: 'linebreak' },
              columnStyles: {
                0: { cellWidth: 10 },
                2: { cellWidth: 25 }
              },
              didDrawCell: (data) => {
                // Add color to the status cell based on status
                if (data.column.index === 2 && data.section === 'body') {
                  const status = this.replayResults[data.row.index].status;
                  if (status === 'success') {
                    doc.setFillColor(0, 128, 0, 0.1); // light green
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                  } else if (status === 'error') {
                    doc.setFillColor(255, 0, 0, 0.1); // light red
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                  } else if (status === 'skipped') {
                    doc.setFillColor(255, 165, 0, 0.1); // light orange
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                  }
                }
              }
            });
            
            // Add footer with page numbers
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(10);
              doc.setTextColor(100, 100, 100);
              doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 
                doc.internal.pageSize.getHeight() - 10, { align: 'center' });
            }
            
            // Save the PDF
            doc.save(`replay-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`);
          });
        }).catch(error => {
          console.error('Error loading PDF libraries:', error);
          alert('Could not generate PDF. Please check console for errors.');
        });
      } catch (error) {
        console.error('Error generating PDF report:', error);
        alert('Error generating PDF report: ' + error.message);
      }
    },
    
    clearAllReplayData() {
      if (confirm('Are you sure you want to clear all replay data? This action cannot be undone.')) {
        // Clear all replay-related data from storage
        chrome.storage.local.remove([
          'latestRecordedData', 
          'replayWindowData', 
          'replayWindowDataCount',
          'autoLoadLatestRecording', 
          'replayProgress', 
          'dataTimestamp'
        ], () => {
          // Reset component data
          this.recordedRequestsData = null;
          this.scenario = null;
          this.scenarioSteps = [];
          this.replayResults = [];
          this.autoLoadedData = false;
          
          // Show confirmation to user
          alert('All replay data has been cleared.');
        });
      }
    },
    
    dumpStorageContents() {
      chrome.storage.local.get(null, (items) => {
        console.log('All storage contents:', Object.keys(items));
        
        // Check specific data structures
        if (items.latestRecordedData) {
          console.log('latestRecordedData info:', {
            count: items.latestRecordedData.length,
            firstItem: items.latestRecordedData[0] ? 
              { url: items.latestRecordedData[0].url, method: items.latestRecordedData[0].method } : null
          });
        }
        
        if (items.replayWindowData) {
          console.log('replayWindowData info:', {
            count: items.replayWindowData.length,
            firstItem: items.replayWindowData[0] ? 
              { url: items.replayWindowData[0].url, method: items.replayWindowData[0].method } : null
          });
        }
      });
    },
    
    showNoDataMessage() {
      // Add UI indication that no data was found
      this.executionStatus = 'No recorded data found to replay';
    },
    
    // Add the missing formatJson method
    formatJson(data) {
      if (!data) return 'No data available';
      
      try {
        if (typeof data === 'object') {
          return JSON.stringify(data, null, 2);
        } else if (typeof data === 'string') {
          // Try to parse as JSON if it's a string
          try {
            const parsed = JSON.parse(data);
            return JSON.stringify(parsed, null, 2);
          } catch {
            // If parsing fails, just return the string
            return data;
          }
        }
        return String(data);
      } catch (e) {
        console.error('Error formatting JSON:', e);
        return String(data);
      }
    },
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
  align-items: center; /* Center the container */
  box-sizing: border-box; /* Ensure padding is included in width */
}

/* Full window mode - use !important to override any conflicting styles */
:global(.full-window) .replay-tab {
  width: 100vw !important;
  max-width: 100vw !important;
  margin: 0 !important;
  padding: 20px !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
}

.content-container {
  width: 100%;
  max-width: 1400px; /* Wider container but not full screen */
  margin: 0 auto;
  box-sizing: border-box; /* Ensure padding is included in width */
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

/* Add styling for the clear all button */
.clear-all-container {
  margin: 15px 0;
  display: flex;
  justify-content: center;
}

.clear-all-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}

.clear-all-btn:hover {
  background-color: #c82333;
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
</style>
