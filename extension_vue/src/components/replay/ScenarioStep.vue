<template>
  <div class="step-item">
    <div class="step-header">
      <label class="step-checkbox">
        <input type="checkbox" v-model="step.enabled" :checked="!step.skip">
        {{ step.skip ? 'Skipped' : 'Enabled' }}
      </label>
      <span class="step-name">{{ step.name || `Step ${index + 1}` }}</span>
      <span class="step-method">{{ step.method }}</span>
      <span class="step-url">{{ step.url }}</span>
    </div>
    
    <div class="step-details" v-if="expanded">
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
          <p>{{ cap.name }}: {{ cap.description || 'No description' }}</p>
          <p>Pattern: {{ cap.regex }}</p>
          <p>Required: {{ cap.required ? 'Yes' : 'No' }}</p>
        </div>
      </div>
    </div>
    
    <button class="toggle-details" @click="toggleDetails">
      {{ expanded ? 'Hide Details' : 'Show Details' }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'ScenarioStep',
  props: {
    step: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    expanded: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    toggleDetails() {
      this.$emit('toggle-details', this.index);
    }
  }
}
</script>

<style scoped>
.step-item {
  border: 1px solid #dee2e6;
  border-radius: 10px;
  margin-bottom: 15px;
  padding: 20px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
}

.step-item:hover {
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 15px;
}

.step-name {
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

.step-details {
  margin-top: 15px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
}

.toggle-details {
  background: none;
  color: #007bff;
  padding: 8px 15px;
  margin-top: 15px;
  box-shadow: none;
  text-decoration: underline;
  font-size: 1rem;
  border: none;
  cursor: pointer;
}

.toggle-details:hover {
  color: #0056b3;
  background: rgba(0, 123, 255, 0.05);
  border-radius: 5px;
  text-decoration: none;
  transform: none;
  box-shadow: none;
}

.step-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.step-checkbox input {
  cursor: pointer;
}

.variable-substitutions, .variable-captures {
  margin-top: 10px;
}

.substitution-item, .capture-item {
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

h5 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1rem;
  color: #495057;
}

.capture-item p {
  margin: 5px 0;
}
</style>
