<template>
  <div class="step-controls">
    <button @click="toggleAll(false)" class="toggle-btn">Skip All</button>
    <button @click="toggleAll(true)" class="toggle-btn">Enable All</button>
  </div>
</template>

<script>
export default {
  name: 'StepControls',
  methods: {
    toggleAll(enabled) {
      this.$emit('toggle-all', enabled);
    }
  }
}
</script>

<style scoped>
.step-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.toggle-btn {
  padding: 6px 12px;
  background-color: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background-color: #dee2e6;
}
</style>
