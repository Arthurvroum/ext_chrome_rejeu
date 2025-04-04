<template>
  <div class="replay-controls">
    <button @click="startReplay" :disabled="isReplaying || disabled" class="primary-btn">
      {{ isReplaying ? 'Replaying...' : 'Start Replay' }}
    </button>
    <button @click="clearResults" :disabled="!hasResults">Clear Results</button>
  </div>
</template>

<script>
export default {
  name: 'ReplayControls',
  props: {
    isReplaying: {
      type: Boolean,
      default: false
    },
    hasResults: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    startReplay() {
      this.$emit('start-replay');
    },
    clearResults() {
      this.$emit('clear-results');
    }
  }
}
</script>

<style scoped>
.replay-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
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

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0,0,0,0.15);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-btn {
  background-color: #007bff;
  color: white;
  padding: 15px 30px;
  font-size: 1.2rem;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.primary-btn:hover:not(:disabled) {
  background-color: #0069d9;
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.4);
}
</style>
