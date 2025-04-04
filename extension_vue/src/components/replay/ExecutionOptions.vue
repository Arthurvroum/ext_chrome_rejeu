<template>
  <div class="execution-options">
    <h4>Execution Options</h4>
    <div class="options-list">
      <div class="option-item">
        <label>
          <input type="checkbox" v-model="stopOnError">
          Stop on First Error
        </label>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExecutionOptions',
  props: {
    initialOptions: {
      type: Object,
      default: () => ({
        stopOnError: true
      })
    }
  },
  data() {
    return {
      stopOnError: this.initialOptions.stopOnError
    }
  },
  watch: {
    stopOnError(newValue) {
      this.$emit('update:options', {
        stopOnError: newValue
      });
    }
  }
}
</script>

<style scoped>
.execution-options {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

h4 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 1.1rem;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 1rem;
}

input[type="checkbox"] {
  cursor: pointer;
}
</style>
