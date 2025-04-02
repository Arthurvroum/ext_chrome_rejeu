<template>
  <div id="app">
    <!-- Add diagnostics button for debugging -->
    <div class="debug-corner">
      <DiagnosticsButton />
    </div>
    
    <!-- For replay tab mode -->
    <ReplayTab v-if="isReplayTab" />
    
    <!-- Regular extension UI -->
    <template v-else>
      <header>
        <h1>Network Request Recorder & Replay</h1>
      </header>

      <main>
        <!-- Simple mode - just recording interface -->
        <div v-if="simpleMode" class="simple-mode">
          <RecordTab @open-replay="openAdvancedWindow('replay')" />
          <div class="advanced-options">
            <button @click="openAdvancedWindow('record')" class="advanced-button">
              Advanced Options
            </button>
          </div>
        </div>
        
        <!-- Advanced mode with tabs for all functions -->
        <div v-else class="advanced-mode">
          <div class="tabs">
            <button 
              :class="{ active: currentTab === 'record' }" 
              @click="currentTab = 'record'"
            >
              Enregistrement
            </button>
            <button 
              :class="{ active: currentTab === 'replay' }" 
              @click="currentTab = 'replay'"
            >
              Rejeu
            </button>
            <button 
              :class="{ active: currentTab === 'config' }" 
              @click="currentTab = 'config'"
            >
              Configuration
            </button>
            <button 
              :class="{ active: currentTab === 'reports' }" 
              @click="currentTab = 'reports'"
            >
              Rapports
            </button>
            <button @click="simpleMode = true" class="back-button">
              Back to Simple Mode
            </button>
          </div>
          
          <div class="tab-content">
            <RecordTab v-if="currentTab === 'record'" @open-replay="switchToReplay" />
            <ReplayTab v-else-if="currentTab === 'replay'" />
            <ConfigTab v-else-if="currentTab === 'config'" />
            <ReportsTab v-else-if="currentTab === 'reports'" />
          </div>
        </div>
      </main>
    </template>
  </div>
</template>

<script>
import RecordTab from './components/RecordTab.vue'
import ReplayTab from './components/ReplayTab.vue'
import ConfigTab from './components/ConfigTab.vue'
import ReportsTab from './components/ReportsTab.vue'
import DiagnosticsButton from './components/DiagnosticsButton.vue'

export default {
  name: 'App',
  components: {
    RecordTab,
    ReplayTab,
    ConfigTab,
    ReportsTab,
    DiagnosticsButton
  },
  data() {
    return {
      currentTab: 'record',
      simpleMode: true, // Start in simple mode
      isReplayTab: false // Renamed from isReplayWindow
    }
  },
  mounted() {
    // Check if we're in replay tab mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('page') === 'replay-window') {
      this.isReplayTab = true;
      document.title = 'Network Request Replay';
      document.getElementById('app').classList.add('full-window');
      
      // Add these lines to ensure proper full-screen display
      document.documentElement.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100%';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      return;
    }
    
    // For regular extension mode
    const tab = urlParams.get('tab');
    if (tab) {
      this.currentTab = tab;
      this.simpleMode = false;
      document.getElementById('app').classList.add('full-window');
      
      // These same styles are needed for tab mode
      document.documentElement.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100%';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
    }
  },
  methods: {
    openAdvancedWindow(tab = 'record') {
      // Now using the runtime message to open a tab instead of a window
      chrome.runtime.sendMessage({
        action: 'openAdvancedWindow',
        tab: tab
      }, (response) => {
        if (response && response.success) {
          console.log('Advanced tab opened with ID:', response.tabId);
        } else {
          console.error('Failed to open advanced tab');
        }
      });
    },
    
    switchToReplay() {
      this.currentTab = 'replay';
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 0;
  padding: 0;
  font-size: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 600px; /* Ensure minimum height */
}

/* For popup mode - larger size to fix visibility issues */
#app:not(.full-window) {
  width: 800px; /* Increased width */
  height: 600px; /* Set height */
  min-width: 600px; /* Ensure minimum width */
  overflow: auto;
}

/* For popup mode - ensure proper size */
body.popup-mode #app {
  width: 500px;
  height: 600px;
  min-height: 500px;
}

/* For full window mode - take all available space */
#app.full-window {
  position: fixed; /* Changed from absolute to fixed */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
}

header {
  background-color: #f8f9fa;
  padding: 8px 10px; /* More compact header */
  border-bottom: 1px solid #dee2e6;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  flex-shrink: 0;
}

h1 {
  font-size: 1.6rem; /* Smaller heading in popup */
  margin: 0 0 5px 0;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  padding: 5px 0;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  gap: 5px;
  flex-shrink: 0;
}

button {
  padding: 8px 12px; /* Slightly larger buttons */
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  margin: 3px;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  white-space: nowrap;
}

/* Full window mode buttons */
.full-window button {
  padding: 12px 20px;
  font-size: 1.1rem;
  margin: 5px;
}

.full-window h1 {
  font-size: 2.2rem;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 5px; /* Reduced padding */
  overflow: auto; /* Allow scrolling in main content if needed */
  height: 100%; /* Make sure main takes full height */
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 5px 0;
}

.tab-content > * {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Styling for the simple mode display */
.simple-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.advanced-options {
  margin-top: 10px; /* Less margin */
  text-align: center;
  flex-shrink: 0; /* Don't allow it to shrink */
}

button.advanced-button {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
  padding: 10px 15px; /* Smaller button */
  font-size: 1rem;
  width: 80%; /* Control width */
  max-width: 300px;
}

/* For replay tab in the full window mode */
.full-window .replay-tab {
  width: 100% !important;
  max-width: 1200px !important; /* Center content with max-width */
  margin: 0 auto !important;
  padding: 20px !important;
  height: 100%;
}

.debug-corner {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 1000;
  opacity: 0.7;
}

.debug-corner:hover {
  opacity: 1;
}
</style>
