<template>
  <div class="reports-tab">
    <h3>Reports</h3>
    
    <div class="report-filters">
      <div class="form-group">
        <label for="filter-date">Filter by Date:</label>
        <input type="date" id="filter-date" v-model="filters.date">
      </div>
      
      <div class="form-group">
        <label for="filter-scenario">Filter by Scenario:</label>
        <input type="text" id="filter-scenario" v-model="filters.scenario" placeholder="Scenario name">
      </div>
      
      <div class="form-group">
        <label for="filter-status">Filter by Status:</label>
        <select id="filter-status" v-model="filters.status">
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="partial">Partial Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      
      <button @click="loadReports">Apply Filters</button>
    </div>
    
    <div class="report-list" v-if="reports.length > 0">
      <div 
        v-for="(report, index) in reports" 
        :key="index"
        class="report-item"
        :class="{ 'success': report.status === 'success', 'partial': report.status === 'partial', 'failed': report.status === 'failed' }"
      >
        <div class="report-header">
          <span class="report-date">{{ formatDate(report.timestamp) }}</span>
          <span class="report-scenario">{{ report.scenario }}</span>
          <span class="report-status">{{ report.status }}</span>
          <div class="report-actions">
            <button @click="viewReport(report)">View</button>
            <button @click="generatePdf(report)">PDF</button>
            <button @click="downloadReport(report)">Download</button>
          </div>
        </div>
        
        <div class="report-details" v-if="expandedReport === index">
          <h4>Execution Summary</h4>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Total Steps:</span>
              <span class="stat-value">{{ report.totalSteps }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Successful:</span>
              <span class="stat-value">{{ report.successfulSteps }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Failed:</span>
              <span class="stat-value">{{ report.failedSteps }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Skipped:</span>
              <span class="stat-value">{{ report.skippedSteps }}</span>
            </div>
          </div>
          
          <h4>Steps</h4>
          <div 
            v-for="(step, stepIndex) in report.steps" 
            :key="`step-${stepIndex}`"
            class="step-item"
            :class="{ 'success': step.status === 'success', 'error': step.status === 'error', 'skipped': step.status === 'skipped' }"
          >
            <div class="step-header">
              <span class="step-name">{{ step.name || `Step ${stepIndex + 1}` }}</span>
              <span class="step-status">{{ step.status }}</span>
            </div>
            
            <div class="step-details" v-if="expandedStep === `${index}-${stepIndex}`">
              <div v-if="step.error" class="step-error">
                <h5>Error</h5>
                <pre>{{ step.error }}</pre>
              </div>
              <div v-if="step.capturedVariables && Object.keys(step.capturedVariables).length > 0" class="step-variables">
                <h5>Captured Variables</h5>
                <div v-for="(value, name) in step.capturedVariables" :key="name" class="variable-item">
                  <span class="variable-name">{{ name }}:</span>
                  <span class="variable-value">{{ value }}</span>
                </div>
              </div>
            </div>
            
            <button class="toggle-details" @click="toggleStep(`${index}-${stepIndex}`)">
              {{ expandedStep === `${index}-${stepIndex}` ? 'Hide Details' : 'Show Details' }}
            </button>
          </div>
        </div>
        
        <button class="toggle-details" @click="toggleReport(index)">
          {{ expandedReport === index ? 'Hide Details' : 'Show Details' }}
        </button>
      </div>
    </div>
    
    <div class="empty-state" v-else>
      <p>No reports available. Run some replays to generate reports.</p>
    </div>
  </div>
</template>

<script>
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default {
  name: 'ReportsTab',
  data() {
    return {
      reports: [],
      expandedReport: null,
      expandedStep: null,
      filters: {
        date: '',
        scenario: '',
        status: ''
      }
    }
  },
  mounted() {
    this.loadReports();
  },
  methods: {
    loadReports() {
      // Load reports from storage
      chrome.storage.local.get('replayReports', (result) => {
        if (result.replayReports) {
          // Apply filters
          this.reports = result.replayReports.filter(report => {
            let match = true;
            
            if (this.filters.date && new Date(report.timestamp).toDateString() !== new Date(this.filters.date).toDateString()) {
              match = false;
            }
            
            if (this.filters.scenario && !report.scenario.toLowerCase().includes(this.filters.scenario.toLowerCase())) {
              match = false;
            }
            
            if (this.filters.status && report.status !== this.filters.status) {
              match = false;
            }
            
            return match;
          });
        } else {
          this.reports = [];
        }
      });
    },
    formatDate(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    },
    toggleReport(index) {
      this.expandedReport = this.expandedReport === index ? null : index;
      this.expandedStep = null;
    },
    toggleStep(key) {
      this.expandedStep = this.expandedStep === key ? null : key;
    },
    viewReport(report) {
      // Show detailed report view
      this.toggleReport(this.reports.indexOf(report));
    },
    generatePdf(report) {
      try {
        const doc = new jsPDF();
        
        // Add header
        doc.setFontSize(18);
        doc.text('Replay Report', 14, 22);
        
        doc.setFontSize(12);
        doc.text(`Scenario: ${report.scenario}`, 14, 32);
        doc.text(`Date: ${this.formatDate(report.timestamp)}`, 14, 39);
        doc.text(`Status: ${report.status}`, 14, 46);
        
        // Add summary table
        doc.setFontSize(14);
        doc.text('Execution Summary', 14, 56);
        
        const summaryData = [
          ['Total Steps', report.totalSteps],
          ['Successful', report.successfulSteps],
          ['Failed', report.failedSteps],
          ['Skipped', report.skippedSteps]
        ];
        
        doc.autoTable({
          startY: 60,
          head: [['Metric', 'Value']],
          body: summaryData
        });
        
        // Add steps table
        doc.setFontSize(14);
        doc.text('Steps', 14, doc.autoTable.previous.finalY + 15);
        
        const stepsData = report.steps.map((step, index) => [
          index + 1,
          step.name || `Step ${index + 1}`,
          step.status,
          step.error || '-'
        ]);
        
        doc.autoTable({
          startY: doc.autoTable.previous.finalY + 20,
          head: [['#', 'Step', 'Status', 'Error']],
          body: stepsData
        });
        
        // Add variables table if any exist
        const allVariables = report.steps.reduce((acc, step) => {
          if (step.capturedVariables && Object.keys(step.capturedVariables).length > 0) {
            Object.entries(step.capturedVariables).forEach(([name, value]) => {
              acc.push([name, value, step.name || `Step ${report.steps.indexOf(step) + 1}`]);
            });
          }
          return acc;
        }, []);
        
        if (allVariables.length > 0) {
          doc.setFontSize(14);
          doc.text('Captured Variables', 14, doc.autoTable.previous.finalY + 15);
          
          doc.autoTable({
            startY: doc.autoTable.previous.finalY + 20,
            head: [['Name', 'Value', 'Step']],
            body: allVariables
          });
        }
        
        // Save the PDF
        doc.save(`replay-report-${report.timestamp.replace(/:/g, '-')}.pdf`);
      } catch (error) {
        alert('Error generating PDF: ' + error.message);
        console.error('PDF generation error:', error);
      }
    },
    downloadReport(report) {
      // Download the report as JSON
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replay-report-${new Date(report.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  }
}
</script>

<style scoped>
.reports-tab {
  text-align: left;
}

.report-filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: #f8f9fa;
}

.form-group {
  margin-bottom: 10px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

button {
  padding: 8px 15px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #e9ecef;
}

.report-list {
  margin-top: 20px;
}

.report-item {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-bottom: 15px;
  padding: 15px;
}

.report-item.success {
  border-left: 4px solid #28a745;
}

.report-item.partial {
  border-left: 4px solid #ffc107;
}

.report-item.failed {
  border-left: 4px solid #dc3545;
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.report-date {
  font-weight: bold;
}

.report-scenario {
  flex-grow: 1;
}

.report-status {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-transform: uppercase;
}

.report-item.success .report-status {
  background-color: #d4edda;
  color: #155724;
}

.report-item.partial .report-status {
  background-color: #fff3cd;
  color: #856404;
}

.report-item.failed .report-status {
  background-color: #f8d7da;
  color: #721c24;
}

.report-actions {
  display: flex;
  gap: 5px;
}

.report-details {
  margin-top: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.summary-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.stat-item {
  padding: 10px;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 0.9rem;
  color: #6c757d;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
}

.step-item {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 10px;
}

.step-item.success {
  border-left: 4px solid #28a745;
}

.step-item.error {
  border-left: 4px solid #dc3545;
}

.step-item.skipped {
  border-left: 4px solid #ffc107;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-name {
  font-weight: bold;
}

.step-status {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-transform: uppercase;
}

.step-item.success .step-status {
  background-color: #d4edda;
  color: #155724;
}

.step-item.error .step-status {
  background-color: #f8d7da;
  color: #721c24;
}

.step-item.skipped .step-status {
  background-color: #fff3cd;
  color: #856404;
}

.step-details {
  margin-top: 10px;
  padding: 10px;
  background-color: white;
  border-radius: 4px;
}

.step-error pre {
  background-color: #f8d7da;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 150px;
  font-size: 12px;
}

.variable-item {
  display: flex;
  margin-bottom: 5px;
}

.variable-name {
  font-weight: bold;
  margin-right: 5px;
}

.toggle-details {
  background: none;
  border: none;
  color: #007bff;
  padding: 5px 0;
  cursor: pointer;
  text-decoration: underline;
  margin-top: 10px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}
</style>
