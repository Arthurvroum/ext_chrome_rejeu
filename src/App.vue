<template>
  <v-app>
    <!-- For replay tab mode -->
    <ReplayTab v-if="isReplayTab" class="fullscreen-component full-width-app" />
    
    <!-- Regular extension UI - simplified to only show Record tab -->
    <template v-else>
      <v-app-bar color="primary" density="compact" elevation="4">
        <v-app-bar-title class="text-white">Network Request Recorder</v-app-bar-title>
      </v-app-bar>

      <v-main>
        <v-container fluid>
          <RecordTab @open-replay="openReplayTab" />
        </v-container>
      </v-main>
    </template>
  </v-app>
</template>

<script>
import RecordTab from './components/record/RecordTab.vue'
import ReplayTab from './components/replay/ReplayTab.vue'

export default {
  name: 'App',
  components: {
    RecordTab,
    ReplayTab
  },
  data() {
    return {
      isReplayTab: false
    }
  },
  mounted() {
    // Check if we're in replay tab mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('page') === 'replay-window') {
      this.isReplayTab = true;
      document.title = 'Network Request Replay';
      
      // Add class to body for full-window-specific styles
      document.body.classList.add('full-window-mode');
      
      // Set essential styling directly to ensure it takes effect immediately
      document.documentElement.style.height = '100%';
      document.documentElement.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100%'; 
      document.body.style.width = '100%';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'relative';
      
      // Force app to take full width 
      document.getElementById('app').style.cssText += 'width: 100vw !important; max-width: 100vw !important; margin: 0 !important; padding: 0 !important;';
      
      return;
    }
    
    // For regular extension mode in full window
    if (urlParams.get('tab') === 'replay') {
      this.isReplayTab = true;
      
      // Add same class for tab mode
      document.body.classList.add('full-window-mode');
      
      // Same essential styling
      document.documentElement.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100%';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
    }
  },
  methods: {
    openReplayTab() {
      chrome.runtime.sendMessage({
        action: 'openAdvancedWindow',
        tab: 'replay'
      }, (response) => {
        if (response && response.success) {
          console.log('Replay tab opened with ID:', response.tabId);
        } else {
          console.error('Failed to open replay tab');
        }
      });
    }
  }
}
</script>

<style>
/* Keep only necessary styles here, Vuetify will handle the rest */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100%;
  height: 100%;
}

.fullscreen-component {
  width: 100vw !important;
  max-width: 100vw !important;
  margin: 0 !important;
  padding: 0 !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  box-sizing: border-box !important;
}

.full-width-app .v-container {
  max-width: 100% !important;
  width: 100% !important;
  padding: 0 !important; 
}

/* Override Vuetify's default container limits */
.v-container.full-width-container {
  max-width: none !important;
  padding: 0 !important;
}

/* Make sure cards in replay tab also take full width */
.replay-tab .v-card {
  width: 100% !important;
}
</style>
