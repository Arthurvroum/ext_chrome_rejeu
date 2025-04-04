<template>
  <div class="replay-tab">
    <div class="content-container">
      <!-- Status header -->
      <status-header :status="executionStatus" />
      
      <!-- File upload section -->
      <file-uploader 
        v-if="!autoLoadedData"
        @file-loaded="processScenario"
        @file-error="handleFileError"
      />
      
      <!-- Clear data button -->
      <clear-data-button 
        v-if="scenario || recordedRequestsData" 
        @clear-data="clearAllReplayData"
      />
      
      <!-- Scenario configuration -->
      <div v-if="scenario || recordedRequestsData" class="scenario-config">
        <h3>{{ (scenario?.info?.title) || 'Recently Recorded Scenario' }}</h3>
        <p>{{ (scenario?.info?.description) || 'This is your recently recorded scenario ready for replay.' }}</p>
        
        <!-- Execution options -->
        <execution-options 
          :initial-options="executionOptions"
          @update:options="updateExecutionOptions"
        />
        
        <div class="scenario-steps">
          <h4>Steps</h4>
          
          <!-- Step controls -->
          <step-controls @toggle-all="toggleAllSteps" />
          
          <!-- Steps list -->
          <scenario-step 
            v-for="(step, index) in scenarioSteps" 
            :key="index"
            :step="step"
            :index="index"
            :expanded="expandedStep === index"
            @toggle-details="toggleStepDetails"
          />
        </div>
        
        <!-- Replay controls -->
        <replay-controls 
          :is-replaying="isReplaying"
          :has-results="!!replayResults.length"
          @start-replay="startReplay"
          @clear-results="clearResults"
        />
        
        <!-- Results section -->
        <div class="replay-results" v-if="replayResults && replayResults.length">
          <h4>Replay Results</h4>
          
          <replay-result 
            v-for="(result, index) in replayResults" 
            :key="`result-${index}`"
            :result="result"
            :expanded="expandedResult === index"
            @toggle-details="toggleResultDetails(index)"
          />
          
          <!-- Export controls -->
          <export-controls 
            @export-results="exportReplayResults"
            @generate-pdf="generatePdfReport"
          />
        </div>
      </div>
      
      <!-- Empty state -->
      <div v-else class="empty-state">
        <p>No scenario loaded. Please load an OpenAPI 3.0 file to get started.</p>
      </div>
    </div>
  </div>
</template>

<script>
import StatusHeader from './StatusHeader.vue';
import FileUploader from './FileUploader.vue';
import ClearDataButton from './ClearDataButton.vue';
import ExecutionOptions from './ExecutionOptions.vue';
import StepControls from './StepControls.vue';
import ScenarioStep from './ScenarioStep.vue';
import ReplayControls from './ReplayControls.vue';
import ReplayResult from './ReplayResult.vue';
import ExportControls from './ExportControls.vue';
import replayService from '../../services/replayService';
import { formatJson } from '../../utils/formatting';

export default {
  name: 'ReplayTab',
  components: {
    StatusHeader,
    FileUploader,
    ClearDataButton,
    ExecutionOptions,
    StepControls,
    ScenarioStep,
    ReplayControls,
    ReplayResult,
    ExportControls
  },
  data() {
    return {
      scenario: null,
      scenarioSteps: [],
      expandedStep: null,
      expandedResult: null,
      isReplaying: false,
      replayResults: [],
      executionStatus: 'Ready to start',
      executionOptions: {
        stopOnError: true,
      },
      recordedRequestsData: null,
      autoLoadedData: false
    }
  },
  mounted() {
    console.log('ReplayTab mounted, checking for data...');
    this.loadStoredData();
  },
  methods: {
    async loadStoredData() {
      try {
        const result = await replayService.loadReplayData();
        
        console.log('Storage data check:', {
          autoLoad: result.autoLoadLatestRecording,
          latestRecordedCount: result.latestRecordedData?.length || 0,
          replayWindowCount: result.replayWindowData?.length || 0,
          countMetadata: result.replayWindowDataCount || 0
        });
        
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
          this.executionStatus = 'No recorded data found to replay';
        }
      } catch (error) {
        console.error('Error loading stored data:', error);
        this.executionStatus = 'Error loading data';
      }
    },
    
    processScenario(data) {
      // Validate that it's an OpenAPI spec
      if (!data.openapi || !data.paths) {
        alert('Invalid OpenAPI format');
        return;
      }
      
      this.scenario = data;
      this.scenarioSteps = replayService.extractStepsFromOpenAPI(data);
      this.executionStatus = 'Scenario loaded successfully';
    },
    
    handleFileError(error) {
      console.error('File error:', error);
      this.executionStatus = 'Error loading file';
    },
    
    toggleStepDetails(index) {
      this.expandedStep = this.expandedStep === index ? null : index;
    },
    
    toggleResultDetails(index) {
      this.expandedResult = this.expandedResult === index ? null : index;
    },
    
    convertRecordedDataToScenario() {
      this.scenarioSteps = replayService.convertRecordedDataToScenario(this.recordedRequestsData);
      this.executionStatus = 'Recorded data loaded successfully';
    },
    
    toggleAllSteps(enabled) {
      this.scenarioSteps.forEach(step => {
        step.skip = !enabled;
        step.enabled = enabled;
      });
    },
    
    updateExecutionOptions(options) {
      this.executionOptions = {...options};
    },
    
    async startReplay() {
      // First clear any previous results
      this.clearResults();
      
      this.isReplaying = true;
      this.executionStatus = 'Replaying...';
      
      try {
        const results = await replayService.startReplay(
          this.scenarioSteps,
          this.executionOptions
        );
        
        this.replayResults = results;
        this.executionStatus = 'Replay completed successfully';
      } catch (error) {
        console.error('Replay error:', error);
        this.executionStatus = `Replay failed: ${error.message}`;
      } finally {
        this.isReplaying = false;
      }
    },
    
    clearResults() {
      this.replayResults = [];
      this.executionStatus = 'Results cleared';
      replayService.clearResults();
    },
    
    exportReplayResults() {
      const scenarioInfo = this.scenario ? this.scenario.info : null;
      replayService.exportReplayResults(scenarioInfo, this.replayResults);
    },
    
    async clearAllReplayData() {
      try {
        await replayService.clearAllReplayData();
        
        // Reset component data
        this.recordedRequestsData = null;
        this.scenario = null;
        this.scenarioSteps = [];
        this.replayResults = [];
        this.autoLoadedData = false;
        this.executionStatus = 'All replay data has been cleared';
      } catch (error) {
        console.error('Error clearing data:', error);
        this.executionStatus = 'Error clearing data';
      }
    },
    
    async generatePdfReport() {
      this.executionStatus = 'Generating PDF report...';
      
      try {
        // Import jsPDF dynamically if not already loaded
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        
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
        this.executionStatus = 'PDF report generated successfully';
      } catch (error) {
        console.error('Error generating PDF report:', error);
        this.executionStatus = `Error generating PDF: ${error.message}`;
        alert('Error generating PDF report: ' + error.message);
      }
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
  overflow: auto;
  align-items: center;
  box-sizing: border-box;
}

/* Full window mode */
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
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
}

.scenario-config {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 15px;
  width: 100%;
  box-shadow: 0 5px 20px rgba(0,0,0,0.1);
  background-color: white;
  flex-grow: 1;
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

h3 {
  font-size: 1.4rem;
  margin: 0 0 5px 0;
}

h4 {
  font-size: 1.2rem;
  margin: 15px 0;
}

.replay-results {
  margin-top: 20px;
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
