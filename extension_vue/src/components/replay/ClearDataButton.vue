<template>
  <div class="clear-all-container">
    <button @click="confirmClear" class="clear-all-btn">
      Clear All Replay Data
    </button>
  </div>
</template>

<script>
export default {
  name: 'ClearDataButton',
  methods: {
    confirmClear() {
      if (confirm('Are you sure you want to clear all replay data? This action cannot be undone.')) {
        this.$emit('clear-data');
      }
    }
  }
}
</script>

<style scoped>
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
