import { getPathFromUrl } from '../utils/formatting';

/**
 * Service for handling replay functionality
 */
const replayService = {
  /**
   * Extract steps from an OpenAPI specification
   * @param {Object} openApiSpec - OpenAPI 3.0 specification
   * @returns {Array} - Array of step objects
   */
  extractStepsFromOpenAPI(openApiSpec) {
    const steps = [];
    
    // Validate that it's an OpenAPI spec
    if (!openApiSpec.openapi || !openApiSpec.paths) {
      console.error('Invalid OpenAPI format');
      return steps;
    }
    
    // Extract steps from paths
    for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters' || method === 'summary' || method === 'description') continue;
        
        const step = {
          name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
          description: operation.description,
          url: path,
          method: method.toUpperCase(),
          skip: false,
          enabled: true,
          parameters: operation.parameters,
          requestBody: operation.requestBody,
          responses: operation.responses,
          variableSubstitutions: [],
          variableCaptures: []
        };
        
        // Extract variable substitutions from x-variable-substitution extension
        if (operation['x-variable-substitution']) {
          step.variableSubstitutions = operation['x-variable-substitution'];
        }
        
        // Extract variable captures from x-variable-capture extension
        if (operation['x-variable-capture']) {
          step.variableCaptures = operation['x-variable-capture'];
        }
        
        steps.push(step);
      }
    }
    
    return steps;
  },
  
  /**
   * Convert recorded requests data to scenario steps
   * @param {Array} recordedRequests - Recorded request data
   * @returns {Array} - Array of step objects
   */
  convertRecordedDataToScenario(recordedRequests) {
    if (!recordedRequests || !recordedRequests.length) {
      console.warn('No recorded data to convert to scenario');
      return [];
    }
    
    return recordedRequests.map((request, index) => {
      // Extract path from URL
      let path = '(unknown path)';
      try {
        const url = request.url || '';
        path = getPathFromUrl(url);
      } catch (e) {
        console.warn('Error parsing URL:', e);
      }
      
      return {
        name: `Request ${index + 1}: ${request.method || 'GET'} ${path}`,
        url: request.url || '',
        method: request.method || 'GET',
        enabled: true,
        skip: false,
        requestHeaders: request.requestHeaders || {},
        requestBody: request.requestBody || null,
        responseHeaders: request.responseHeaders || {},
        variableSubstitutions: [],
        variableCaptures: request.variableCapture || []
      };
    });
  },
  
  /**
   * Start replay execution
   * @param {Array} steps - Steps to replay
   * @param {Object} options - Execution options
   * @returns {Promise} - Promise that resolves with results
   */
  startReplay(steps, options) {
    // Update skip status based on enabled property
    const preparedSteps = steps.map(step => ({
      ...step,
      skip: !step.enabled
    }));
    
    // Prepare the scenario for replay
    const replayConfig = {
      options,
      steps: preparedSteps
    };
    
    // Send message to background script to execute replay
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          action: 'replayRequests', 
          scenario: replayConfig 
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.status === 'Replay completed') {
            resolve(response.results);
          } else {
            reject(new Error(response?.error || 'Unknown error during replay'));
          }
        }
      );
    });
  },
  
  /**
   * Clear replay results
   * @returns {Promise} - Promise that resolves when data is cleared
   */
  clearResults() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([
        'replayProgress', 
        'replayProgressTimestamp'
      ], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  /**
   * Clear all replay data
   * @returns {Promise} - Promise that resolves when data is cleared
   */
  clearAllReplayData() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([
        'latestRecordedData', 
        'replayWindowData', 
        'replayWindowDataCount',
        'autoLoadLatestRecording', 
        'replayProgress', 
        'dataTimestamp'
      ], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  /**
   * Export replay results as JSON file
   * @param {Object} scenarioInfo - Information about the scenario
   * @param {Array} results - Results of the replay
   */
  exportReplayResults(scenarioInfo, results) {
    const resultData = {
      timestamp: new Date().toISOString(),
      scenario: scenarioInfo?.title || 'Recorded Requests Replay',
      description: scenarioInfo?.description || 'Replay of recorded network requests',
      results,
      summary: {
        totalSteps: results.length,
        successCount: results.filter(r => r.status === 'success').length,
        errorCount: results.filter(r => r.status === 'error').length,
        skippedCount: results.filter(r => r.status === 'skipped').length
      }
    };
    
    const blob = new Blob([JSON.stringify(resultData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    // Cleanup approach to avoid memory leaks
    a.onclick = () => {
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 150);
    };
    
    a.click();
  },
  
  /**
   * Load data from storage
   * @returns {Promise} - Promise that resolves with loaded data
   */
  loadReplayData() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([
        'latestRecordedData', 
        'autoLoadLatestRecording', 
        'replayWindowData', 
        'replayWindowDataCount'
      ], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }
};

export default replayService;
