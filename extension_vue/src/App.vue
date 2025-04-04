<template>
  <div id="app">
    <!-- Diagnostic button removed -->
    
    <!-- For replay tab mode -->
    <ReplayTab v-if="isReplayTab" class="fullscreen-component" />
    
    <!-- Regular extension UI -->
    <template v-else>
      <header>
        <h1>Network Request Recorder & Replay</h1>
      </header>

      <main>
        <!-- Simple two-tab interface -->
        <div class="simple-interface">
          <div class="tabs">
            <button 
              :class="{ active: currentTab === 'record' }" 
              @click="currentTab = 'record'"
            >
              Record
            </button>
            <button 
              :class="{ active: currentTab === 'replay' }" 
              @click="currentTab = 'replay'"
            >
              Replay
            </button>
          </div>
          
          <div class="tab-content">
            <RecordTab v-if="currentTab === 'record'" @open-replay="switchToReplay" />
            <ReplayTab v-else-if="currentTab === 'replay'" />
          </div>
        </div>
      </main>
    </template>
  </div>
</template>

<script>
// Update the import path to the new location
import RecordTab from './components/record/RecordTab.vue'
import ReplayTab from './components/ReplayTab.vue'
// Removed DiagnosticsButton import

export default {
  name: 'App',
  components: {
    RecordTab,
    ReplayTab
    // Removed DiagnosticsButton component
  },
  data() {
    return {
      currentTab: 'record',
      isReplayTab: false
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
    if (tab === 'record' || tab === 'replay') {
      this.currentTab = tab;
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
    switchToReplay() {
      this.currentTab = 'replay';
    },
    
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
#app.full-window .replay-tab {
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

/* Simplified interface styles */
.simple-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.tabs {
  display: flex;
  justify-content: center;
  padding: 10px 0;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  gap: 10px;
  flex-shrink: 0;
}

.tabs button {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1rem;
  border: none;
  background-color: #e9ecef;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
}

.tabs button.active {
  background-color: #007bff;
  color: white;
  box-shadow: 0 2px 5px rgba(0, 123, 255, 0.3);
}

.tabs button:hover:not(.active) {
  background-color: #dee2e6;
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 5px 0;
  overflow: auto;
}

.tab-content > * {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* For full window buttons */
.full-window .tabs button {
  padding: 12px 25px;
  font-size: 1.2rem;
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

/* For replay tab in the full window mode */
.full-window .replay-tab {
  width: 100% !important;
  max-width: 1200px !important; /* Center content with max-width */
  margin: 0 auto !important;
  padding: 20px !important;
  height: 100%;
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
