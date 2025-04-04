<template>
  <div class="header">
    <h1>Network Request Replay</h1>
    <div class="execution-status" :class="statusClass">
      {{ status }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatusHeader',
  props: {
    status: {
      type: String,
      default: 'Ready'
    }
  },
  computed: {
    statusClass() {
      if (this.status.includes('Error') || this.status.includes('Failed')) {
        return 'error';
      } else if (this.status.includes('Success') || this.status.includes('Complete')) {
        return 'success';
      } else if (this.status.includes('Replaying')) {
        return 'in-progress';
      }
      return '';
    }
  }
}
</script>

<style scoped>
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
  flex-shrink: 0;
}

h1 {
  font-size: 1.4rem;
  font-weight: 700;
  color: #333;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  margin: 0;
}

.execution-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
  background-color: #e9ecef;
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
</style>
