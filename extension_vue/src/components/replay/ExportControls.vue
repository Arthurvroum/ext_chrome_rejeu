<template>
  <div class="export-section">
    <button @click="exportResults" class="export-btn">Export Results</button>
    <button @click="generatePdfReport" class="pdf-btn">Generate PDF Report</button>
  </div>
</template>

<script>
export default {
  name: 'ExportControls',
  methods: {
    exportResults() {
      this.$emit('export-results');
    },
    generatePdfReport() {
      this.$emit('generate-pdf');
    }
  }
}
</script>

<style scoped>
.export-section {
  display: flex;
  gap: 15px;
  margin-top: 20px;
}

button {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 3px 8px rgba(0,0,0,0.1);
  border: none;
  background-color: #6c757d;
  color: white;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0,0,0,0.15);
}

.export-btn {
  background-color: #28a745;
}

.export-btn:hover {
  background-color: #218838;
}

.pdf-btn {
  background-color: #dc3545;
}

.pdf-btn:hover {
  background-color: #c82333;
}
</style>
