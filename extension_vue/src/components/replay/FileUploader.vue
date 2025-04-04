<template>
  <div class="file-uploader">
    <label :for="inputId">{{ label }}</label>
    <input 
      type="file" 
      :id="inputId" 
      @change="handleFileUpload" 
      :accept="accept"
    >
    <p class="description">{{ description }}</p>
  </div>
</template>

<script>
export default {
  name: 'FileUploader',
  props: {
    label: {
      type: String,
      default: 'Load Scenario (OpenAPI 3.0):'
    },
    inputId: {
      type: String,
      default: 'scenario-file'
    },
    accept: {
      type: String,
      default: '.json'
    },
    description: {
      type: String,
      default: 'Upload your OpenAPI 3.0 file to replay network requests.'
    }
  },
  methods: {
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.$emit('file-loaded', data);
        } catch (error) {
          this.$emit('file-error', error);
          alert('Error parsing file: ' + error.message);
        }
      };
      reader.onerror = (e) => {
        this.$emit('file-error', e.target.error);
        alert('Error reading file: ' + e.target.error);
      };
      reader.readAsText(file);
    }
  }
}
</script>

<style scoped>
.file-uploader {
  margin-bottom: 15px;
  width: 100%;
  text-align: center;
  flex-shrink: 0;
}

.file-uploader label {
  display: block;
  margin-bottom: 8px;
  font-size: 1rem;
  font-weight: 600;
}

.description {
  color: #6c757d;
  margin-top: 8px;
  font-size: 0.9rem;
}
</style>
