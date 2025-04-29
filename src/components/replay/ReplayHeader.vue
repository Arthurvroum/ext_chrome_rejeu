<template>
  <v-card elevation="1" class="mb-3 header-card">
    <v-toolbar
      color="primary"
      dark
      density="comfortable"
      class="rounded header-toolbar"
    >
      <v-toolbar-title class="text-h5 font-weight-bold">
        Network Request Replay
      </v-toolbar-title>
      
      <v-toolbar-subtitle class="text-caption mt-1">
        Execute and analyze recorded network requests
      </v-toolbar-subtitle>
      
      <v-spacer></v-spacer>
      
      <v-btn 
        color="white"
        variant="text"
        size="small"
        prepend-icon="mdi-upload"
        @click="triggerFileInput"
      >
        Load File
      </v-btn>
      
      <input
        ref="fileInput"
        type="file"
        style="display: none"
        @change="onFileSelected"
        accept=".json"
      >
    </v-toolbar>
  </v-card>
</template>

<script>
export default {
  name: 'ReplayHeader',
  props: {
    executionStatus: {
      type: String,
      default: 'Ready to start'
    },
    autoLoadedData: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    triggerFileInput() {
      // Trigger the hidden file input
      this.$refs.fileInput.click();
    },
    onFileSelected(event) {
      // Pass the file to the parent component
      const file = event.target?.files?.[0];
      if (file) {
        this.$emit('load-file', file);
      }
    }
  }
}
</script>

<style scoped>
.header-card {
  width: 100%;
}

.header-toolbar {
  width: 100%;
}

/* Ensure button text doesn't wrap in smaller viewports */
.v-btn {
  white-space: nowrap;
}
</style>
