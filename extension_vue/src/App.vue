<template>
  <div id="app">
    <!-- Add diagnostics button for debugging -->
    <div class="debug-corner">
      <DiagnosticsButton />
    </div>
    
    <!-- For replay tab mode -->
    <ReplayTab v-if="isReplayTab" class="fullscreen-component" />
    
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
      document.documentElement.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100%'; 
      document.body.style.width = '100%';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'relative';
      
      // Force all parent containers to take full width
      setTimeout(() => {
        const appElement = document.getElementById('app');
        if (appElement) {
          // Force full width with !important
          appElement.style.cssText += 'width: 100vw !important; max-width: 100vw !important; left: 0 !important; position: absolute !important;';
          
          // Also find any direct children and ensure they take full width
          const children = appElement.children;
          for (let i = 0; i < children.length; i++) {
            children[i].style.cssText += 'width: 100% !important; max-width: 100% !important;';
          }
        }
      }, 0);
      
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
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  z-index: 1 !important;
}

/* Full window content container should be centered and take full width */
#app.full-window .tab-content,
#app.full-window main {
  width: 100%;
  max-width: 100%;
  padding: 0;
  margin: 0 auto;
  box-sizing: border-box; /* Ensure padding is included in width */
}

/* Make tab content take full width but center the actual content */
#app.full-window .tab-content > * {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box; /* Ensure padding is included in width */
}

/* Ensure tab components take full width in tab mode */
#app.full-window .record-tab,
#app.full-window .replay-tab,
#app.full-window .config-tab,
#app.full-window .reports-tab {
  width: 100%;
  max-width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

/* Container for actual content in full-width mode */
.content-container {
  width: 100%;
  max-width: 1400px; /* Wider but not full screen width */
  margin: 0 auto;
  box-sizing: border-box; /* Ensure padding is included in width */
}

header {
  background-color: #f8f9fa;
  padding: 8px 10px; /* More compact header */
  border-bottom: 1px solid #dee2e6;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box; /* Ensure padding is included in width */
}

/* Make header take full width in tab mode */
#app.full-window header {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
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
  position: fixed !important;
  top: 5px !important;
  right: 5px !important;
  z-index: 2000 !important; /* Higher z-index to ensure it's above everything */
  opacity: 0.7;
}

.debug-corner:hover {
  opacity: 1;
}

/* Ensure full window components take the entire width */
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
</style>
