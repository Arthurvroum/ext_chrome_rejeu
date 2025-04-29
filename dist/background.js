// Global variables to store recording state and captured requests
let isRecording = false;
let recordedRequests = [];
let capturedVariables = {};
let activeTabId = null;
let recordingStartTime = null;

// Maps pour stocker les requêtes en cours et leurs headers
let pendingRequests = new Map();
let pendingBodies = new Map();
let requestHeaders = new Map();
let requestBodies = new Map();

// Variables pour les fonctions importées - les initialiser comme null
let importedSafelySendTabMessage = null;
let importedSafeInject = null;
let importedEnsureContentScriptLoaded = null;
let importedTrackTab = null;
let importedOpenAdvancedTab = null;
let importedOpenReplayTab = null;

// Utiliser importScripts() pour charger les dépendances - méthode compatible avec les Service Workers
try {
  // Chargement direct des scripts avec importScripts
  self.importScripts(
    'service-worker-compatibility.js',
    'message-utils.js',
    'safe-injection.js',
    'connection-utils.js',
    'tab-manager.js'
  );
  console.log('Scripts successfully imported via importScripts');
  
  // Essayer de récupérer les fonctions importées des scripts chargés
  if (typeof self.messageUtils !== 'undefined') {
    importedSafelySendTabMessage = self.messageUtils.safelySendTabMessage;
    console.log('Imported safelySendTabMessage from global object');
  }
  
  if (typeof self.connectionUtils !== 'undefined') {
    importedEnsureContentScriptLoaded = self.connectionUtils.ensureContentScriptLoaded;
    console.log('Imported ensureContentScriptLoaded from global object');
  }

  if (typeof self.safeInjection !== 'undefined') {
    importedSafeInject = self.safeInjection.safeInject;
    console.log('Imported safeInject from global object');
  }
  
  if (typeof self.tabManager !== 'undefined') {
    importedTrackTab = self.tabManager.trackTab;
    importedOpenAdvancedTab = self.tabManager.openAdvancedTab;
    importedOpenReplayTab = self.tabManager.openReplayTab;
    console.log('Imported tab manager functions from global object');
  }
  
} catch (importError) {
  console.error('Error loading scripts via importScripts:', importError);
}

// Log function for debugging
function logDebug(message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Background] ${message}`, data || '');
}

// Initialize state when the extension loads
chrome.runtime.onInstalled.addListener(() => {
  logDebug('Extension installed/updated');
  // IMPORTANT: Reset recording state on extension install/update
  isRecording = false;
  recordedRequests = [];
  
  try {
    // Reset recording state in storage
    chrome.storage.local.set({
      recordingState: {
        isRecording: false,
        activeTabId: null,
        recordingStartTime: null
      }
    }, () => {
      logDebug('Recording state reset on extension install/update');
    });
    
    // Clear any saved requests
    chrome.storage.local.remove('recordedRequests', () => {
      logDebug('Cleared saved recorded requests');
    });
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

// Save recording state to persistent storage
function saveRecordingState() {
  chrome.storage.local.set({
    recordingState: {
      isRecording,
      activeTabId,
      recordingStartTime
    }
  });
  
  // Also save captured requests periodically
  if (isRecording && recordedRequests.length > 0) {
    chrome.storage.local.set({ recordedRequests });
  }
}

// Listen for tab updates - use MV3 compatible approach
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isRecording && tabId === activeTabId && changeInfo.status === 'complete') {
    logDebug('Tracked tab was updated/navigated', { tabId, url: tab.url });
    
    // Use local functions or properly access through self instead of window
    setTimeout(() => {
      try {
        // Utiliser ensureContentScriptLoaded pour s'assurer que le content script est chargé
        ensureContentScriptLoaded(tabId, success => {
          if (success) {
            logDebug('Content script is available after navigation');
            
            // Envoyer un message au content script pour commencer l'observation
            safelySendTabMessage(tabId, { action: 'startObserving' }, response => {
              logDebug('Content script response after navigation:', response);
            });
          } else {
            logDebug('Failed to ensure content script is loaded in tab after multiple attempts');
          }
        });
      } catch (error) {
        logDebug('Exception during tab update handling', error.message);
      }
    }, 1000); // Increased timeout to ensure page is ready
  }
});

// GESTIONNAIRE DE MESSAGES UNIFIÉ
// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Fast path for recording status check
  if (request.action === 'getRecordingStatus') {
    sendResponse({ 
      isRecording, 
      activeTabId, 
      recordingStartTime,
      requestCount: recordedRequests.length,
      extensionStatus: 'OK'
    });
    return true;
  }
  
  // Log for other actions
  console.log('[Background] Received message:', request.action);
  
  // Fast path for starting recording
  if (request.action === 'startRecording') {
    // Check if target tab is a restricted URL
    chrome.tabs.get(request.tabId, tab => {
      if (chrome.runtime.lastError) {
        sendResponse({ 
          status: 'error', 
          error: `Error accessing tab: ${chrome.runtime.lastError.message}` 
        });
        return;
      }
      
      // Get safeInjection utility - use our improved safelyGetGlobal function
      const safeInjectionUtil = safelyGetGlobal('safeInjection');
      
      // Check if URL is restricted
      let isRestricted = false;
      if (safeInjectionUtil && typeof safeInjectionUtil.isRestrictedUrl === 'function') {
        isRestricted = safeInjectionUtil.isRestrictedUrl(tab.url);
      } else {
        // Fallback to manual check
        isRestricted = isRestrictedUrlFallback(tab.url);
      }
      
      if (isRestricted) {
        sendResponse({ 
          status: 'error', 
          error: 'Cannot record from restricted URLs like browser pages or extension pages',
          restrictedUrl: true
        });
        return;
      }
      
      // If URL is valid, proceed with recording setup
      activeTabId = request.tabId;
      isRecording = true;
      recordingStartTime = Date.now();
      recordedRequests = []; // Reset recorded requests
      saveRecordingState();
      
      // Make sure content script is injected before starting recording
      ensureContentScriptLoaded(activeTabId, (success) => {
        if (success) {
          // Content script is now available, tell it to start observing
          safelySendTabMessage(activeTabId, { action: 'startObserving' }, () => {
            logDebug('Content script informed to start observing');
          });
          sendResponse({ status: 'Recording started', tabId: activeTabId });
        } else {
          // Content script couldn't be loaded - still record network requests but no DOM events
          logDebug('Content script could not be loaded, but network recording will still work');
          sendResponse({ 
            status: 'Recording started with limited capabilities', 
            tabId: activeTabId,
            warning: 'Content script unavailable - some features may not work'
          });
        }
      });
      
      // Keep message channel open for async response
      return true;
    });
    
    return true; // Keep messaging channel open for async response
  }
  
  // Check for extension health
  if (request.action === 'checkExtensionStatus') {
    sendResponse({ status: 'Background script is active' });
    return true;
  }
  
  // Handle stop recording
  if (request.action === 'stopRecording') {
    isRecording = false;
    logDebug('Recording stopped. Captured requests:', recordedRequests.length);
    saveRecordingState();
    sendResponse({ 
      status: 'Recording stopped', 
      data: recordedRequests 
    });
    // Clear stored requests after sending them to the popup
    chrome.storage.local.remove('recordedRequests');
    return true;
  }
  
  // Handle get recorded data
  else if (request.action === 'getRecordedData') {
    sendResponse({ data: recordedRequests });
    return true;
  }
  
  // Handle getCurrentTabId
  else if (request.action === 'getCurrentTabId') {
    // Added to help content scripts identify themselves
    sendResponse({ id: sender.tab?.id });
    return true;
  }
  
  // Handle convertToOpenAPI
  else if (request.action === 'convertToOpenAPI') {
    const openApiSpec = convertToOpenAPI(request.data);
    sendResponse({ openApiSpec });
    return true;
  }
  
  // Handle replayRequests
  else if (request.action === 'replayRequests') {
    replayRequests(request.scenario)
      .then(results => sendResponse({ status: 'Replay completed', results }))
      .catch(error => sendResponse({ status: 'Replay failed', error: error.message }));
    return true; // Required for async response
  }
  
  // Handle captureVariable
  else if (request.action === 'captureVariable') {
    capturedVariables[request.name] = request.value;
    sendResponse({ status: 'Variable captured' });
    return true;
  }
  
  // Handle startReplayWithTracking
  else if (request.action === 'startReplayWithTracking') {
    startReplayWithTracking(request.steps, request.options)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
  
  // Handle stopReplay
  else if (request.action === 'stopReplay') {
    const result = stopLiveReplay();
    sendResponse(result);
    return true;
  }
  
  // Handle openAdvancedWindow
  else if (request.action === 'openAdvancedWindow') {
    console.log('Processing openAdvancedWindow request');
    try {
      // Utiliser la méthode importée depuis tab-manager.js
      const openTabFunction = self.tabManager?.openAdvancedTab || openAdvancedTab;
      
      // Ajoutons un log pour débogage
      console.log('Opening advanced tab with function:', typeof openTabFunction);
      
      // N'ouvrir qu'un seul onglet
      openTabFunction(request.tab || 'record', (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error in response handling:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response);
        }
      });
      return true;
    } catch (error) {
      console.error('Error opening advanced tab:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  // Handle openReplayWindow
  else if (request.action === 'openReplayWindow') {
    logDebug('Opening replay tab', { dataLength: request.data?.length });
    try {
      // Utiliser la méthode importée depuis tab-manager.js
      const openReplayFunction = self.tabManager?.openReplayTab || openReplayTab;
      
      // N'ouvrir qu'un seul onglet
      openReplayFunction(request.data, (response) => {
        sendResponse(response);
      });
      return true; // Keep the message channel open for async response
    } catch (error) {
      console.error('Error opening replay tab:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  // Handle updateReplayProgress
  else if (request.action === 'updateReplayProgress') {
    try {
      // Utiliser la méthode importée depuis tab-manager.js
      const updateProgressFunction = self.tabManager?.updateReplayProgress || updateReplayProgress;
      
      updateProgressFunction(request.progressData, (response) => {
        sendResponse(response);
      });
      return true;
    } catch (error) {
      console.error('Error updating replay progress:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  else {
    // Unknown action
    logDebug('Unknown action received:', request.action);
    sendResponse({ status: 'error', message: 'Unknown action' });
    return true;
  }
  
  // In MV3, we need to return true for asynchronous responses
  return true;
});

// Set up web request listener for capturing requests - MV3 compatible
chrome.webRequest.onBeforeRequest.addListener(
  captureRequest,
  { 
    urls: ["<all_urls>"] 
  },
  ["requestBody"]  // Cette option est cruciale pour accéder au corps des requêtes
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  captureRequestHeaders,
  { 
    urls: ["<all_urls>"] 
  },
  ["requestHeaders"]  // Cette option est nécessaire pour capturer les en-têtes
);

chrome.webRequest.onCompleted.addListener(
  captureResponse,
  { 
    urls: ["<all_urls>"] 
  },
  ["responseHeaders"]  // Pour capturer les en-têtes de réponse
);

// Function to capture request data
function captureRequest(details) {
  if (!isRecording) return;
  
  // Check if it's from the tab we're recording or any of its frames
  if (details.tabId !== activeTabId) {
    return;
  }
  
  logDebug('Capturing request:', details.url);
  
  // Parse URL pour extraire le chemin relatif
  let relativePath = '';
  let fullUrl = details.url;
  try {
    const urlObj = new URL(fullUrl);
    relativePath = urlObj.pathname + urlObj.search;
  } catch (e) {
    console.error('Error parsing URL:', e);
    relativePath = fullUrl;
  }
  
  // Traitement du corps de la requête (requestBody)
  let requestBody = {};
  if (details.requestBody) {
    if (details.requestBody.raw && details.requestBody.raw[0]) {
      try {
        // Décodage complet des données brutes (raw) en UTF-8
        const decoder = new TextDecoder('utf-8');
        const rawData = decoder.decode(details.requestBody.raw[0].bytes);
        
        // Capture exacte des données JSON pour Odoo ou autres APIs
        try {
          if (rawData.trim().startsWith('{') || rawData.trim().startsWith('[')) {
            // Préserver la structure JSON exacte
            requestBody = JSON.parse(rawData);
            console.log('------------ DÉBUT CAPTURE DE REQUÊTE ------------');
            console.log('URL:', details.url);
            console.log('Méthode:', details.method);
            console.log('Corps JSON capturé:', JSON.stringify(requestBody, null, 2));
            console.log('------------ FIN CAPTURE DE REQUÊTE ------------');
          } else {
            requestBody = { rawData };
          }
        } catch (e) {
          console.warn('Failed to parse request body as JSON:', e);
          requestBody = { rawData };
        }
      } catch (e) {
        console.error('Error processing request body:', e);
      }
    } else if (details.requestBody.formData) {
      // Capture exacte des données de formulaire
      requestBody = details.requestBody.formData;
      console.log('Captured form data:', requestBody);
    }
  }
  
  // Stocker la requête avec l'ID de la requête pour référence
  pendingBodies.set(details.requestId, requestBody);
  
  // Vérifier si nous avons déjà les en-têtes pour cette requête
  const headers = requestHeaders.get(details.requestId) || {};
  let contentType = '';
  
  // Extraire le content-type des en-têtes si disponible
  if (Object.keys(headers).length > 0) {
    contentType = headers['content-type'] || headers['Content-Type'] || '';
  }
  
  // Créer l'objet de requête dans le format attendu par l'exemple
  const requestData = {
    id: details.requestId,
    url: details.url,
    method: details.method,
    type: details.type,
    relativePath: relativePath,
    requestBody: requestBody,
    headers: headers,
    contentType: contentType,
    timeStamp: details.timeStamp,
    variableCaptures: [],
    substitutionVariables: {}
  };
  
  // Ajouter à recordedRequests ou mettre à jour l'existant
  const existingIndex = recordedRequests.findIndex(req => req.id === details.requestId);
  if (existingIndex >= 0) {
    // Mettre à jour l'enregistrement existant
    recordedRequests[existingIndex] = {
      ...recordedRequests[existingIndex],
      ...requestData
    };
  } else {
    // Ajouter un nouvel enregistrement
    recordedRequests.push(requestData);
  }
  
  // Pour les requêtes Odoo, afficher un résumé complet de ce qui est enregistré
  if (details.url.includes('/web/dataset/call_kw/')) {
    console.log('=============== REQUÊTE ODOO ENREGISTRÉE ===============');
    console.log('URL: ' + details.url);
    console.log('Chemin relatif: ' + relativePath);
    console.log('Méthode: ' + details.method);
    console.log('Headers:', headers);
    console.log('RequestBody complet:', requestBody);
    console.log('Format enregistré:', JSON.stringify({
      url: details.url,
      method: details.method,
      headers: headers,
      requestBody: requestBody
    }, null, 2));
    console.log('========================================================');
    
    // Enregistrer l'état immédiatement pour les requêtes Odoo importantes
    saveRecordingState();
  } else if (recordedRequests.length % 10 === 0) {
    saveRecordingState();
  }
}

// Function to capture request headers
function captureRequestHeaders(details) {
  if (!isRecording || details.tabId !== activeTabId) return;
  
  // Convertir les en-têtes en objet simple
  const headersObj = {};
  if (details.requestHeaders && Array.isArray(details.requestHeaders)) {
    details.requestHeaders.forEach(header => {
      headersObj[header.name] = header.value;
    });
  }
  
  // Stocker les en-têtes
  requestHeaders.set(details.requestId, headersObj);
  
  // Récupérer le corps de la requête s'il existe déjà
  const requestBody = pendingBodies.get(details.requestId) || {};
  
  // Mettre à jour la requête existante avec les en-têtes
  const existingRequest = recordedRequests.find(req => req.id === details.requestId);
  if (existingRequest) {
    existingRequest.headers = headersObj;
    existingRequest.contentType = headersObj['content-type'] || headersObj['Content-Type'] || '';
    
    // Si nous avons déjà un corps, associons-les
    if (Object.keys(requestBody).length > 0) {
      existingRequest.requestBody = requestBody;
    }
  } else {
    // Si nous n'avons pas encore la requête, créons-en une nouvelle
    const contentType = headersObj['content-type'] || headersObj['Content-Type'] || '';
    
    // Parse URL pour extraire le chemin relatif
    let relativePath = '';
    try {
      const urlObj = new URL(details.url);
      relativePath = urlObj.pathname + urlObj.search;
    } catch (e) {
      relativePath = details.url;
    }
    
    // Créer une nouvelle requête avec les en-têtes
    recordedRequests.push({
      id: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      relativePath: relativePath,
      requestBody: requestBody,
      headers: headersObj,
      contentType: contentType,
      timeStamp: details.timeStamp,
      variableCaptures: [],
      substitutionVariables: {}
    });
  }
  
  // Maintenant que nous avons utilisé ce corps, supprimons-le de la map
  pendingBodies.delete(details.requestId);
}

// Function to capture response
function captureResponse(details) {
  if (!isRecording || details.tabId !== activeTabId) return;
  
  const existingRequest = recordedRequests.find(req => req.id === details.requestId);
  if (existingRequest) {
    existingRequest.responseHeaders = details.responseHeaders;
    existingRequest.statusCode = details.statusCode;
    existingRequest.fromCache = details.fromCache;
    
    // Process variable capture if regex patterns are defined
    if (existingRequest.variableCapture) {
      processVariableCapture(existingRequest);
    }
  }
}

// Function to process variable capture using regex
function processVariableCapture(request) {
  // This would be implemented based on the configuration from the UI
  // Example: extracting values from response body or headers using regex
}

// Function to replay requests
async function replayRequests(scenario) {
  const results = [];
  const stopOnError = scenario.options?.stopOnError || false;
  const errorOnCapture = scenario.options?.errorOnCapture || false;
  
  console.log(`[DEBUG ERRORCAPTURE] Starting replay with options:`, {
    stopOnError,
    errorOnCapture,
    rawOptions: JSON.stringify(scenario.options)
  });
  
  for (const step of scenario.steps) {
    // Skip step if configured to be skipped
    if (step.skip) {
      results.push({ step: step.name, status: 'skipped' });
      continue;
    }
    
    try {
      // Process variable substitution
      const processedRequest = processVariableSubstitution(step, capturedVariables);
      
      console.log(`Executing request: ${step.method} ${step.url}`);
      
      // Execute the request - use the full URL from the step
      const response = await executeRequest(processedRequest);
      
      // Process variable capture from response
      let capturedVars = {};
      let missingRequiredVars = [];
      let hasError = false;
      
      if (step.variableCaptures && step.variableCaptures.length > 0) {
        console.log(`[DEBUG ERRORCAPTURE] Step has ${step.variableCaptures.length} variable captures, errorOnCapture=${errorOnCapture}`);
        // Récupérer à la fois les variables capturées et celles manquantes
        const captureResult = processStepVariableCapture(response, step.variableCaptures);
        capturedVars = captureResult.capturedVars;
        missingRequiredVars = captureResult.missingRequiredVars;
        
        const capturedVarsCount = Object.keys(capturedVars).length;
        const missingRequiredVarsCount = missingRequiredVars.length;
        
        console.log(`[DEBUG ERRORCAPTURE] Captured ${capturedVarsCount} variables:`, capturedVars);
        console.log(`[DEBUG ERRORCAPTURE] Missing ${missingRequiredVarsCount} required variables:`, missingRequiredVars);
        console.log(`[DEBUG ERRORCAPTURE] errorOnCapture setting: ${errorOnCapture}, type: ${typeof errorOnCapture}`);
        
        // Deux cas d'erreur possibles:
        // 1. Variables capturées alors que errorOnCapture est activé
        if (capturedVarsCount > 0 && errorOnCapture === true) {
          console.log(`[DEBUG ERRORCAPTURE] ERREUR DÉTECTÉE: Variables capturées alors que errorOnCapture=true`);
          hasError = true;
        }
        // 2. Variables obligatoires non capturées
        else if (missingRequiredVarsCount > 0) {
          console.log(`[DEBUG ERRORCAPTURE] ERREUR DÉTECTÉE: Variables obligatoires non capturées`);
          hasError = true;
        }
      }
      
      // Déterminer le statut de l'étape
      let status = 'success';
      let errorMessage = null;
      
      // Cas 1: Erreur HTTP
      if (response.status >= 300) {
        status = 'error';
        errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
        console.log(`[DEBUG ERRORCAPTURE] Error set due to HTTP status: ${response.status}`);
      }
      // Cas 2: Erreur sur capture de variable
      else if (hasError) {
        status = 'error';
        // Message d'erreur amélioré avec les valeurs capturées
        const captureDetails = Object.entries(capturedVars)
          .map(([name, value]) => `${name} = "${value}"`)
          .join(', ');
        errorMessage = `Error captured variable : ${captureDetails}`;
        console.log(`[DEBUG ERRORCAPTURE] Error set due to variable capture: ${errorMessage}`);
      }
      
      const result = {
        step: step.name,
        status: status,
        request: processedRequest,
        response: response,
        capturedVariables: capturedVars,
        error: errorMessage
      };
      
      console.log(`[DEBUG ERRORCAPTURE] Final result status for step: ${status}`);
      results.push(result);
      
      // Si le statut est une erreur et que l'option stopOnError est activée, arrêter le replay
      if (status === 'error' && stopOnError) {
        console.error(`Stopping replay due to error in step ${step.name}: ${errorMessage}`);
        break;
      }
    } catch (error) {
      console.error(`Error executing step ${step.name}:`, error);
      results.push({
        step: step.name,
        status: 'error',
        error: error.message
      });
      
      if (stopOnError) break;
    }
  }
  
  console.log('[DEBUG ERRORCAPTURE] Replay completed, results:', results.map(r => `${r.step}: ${r.status}${r.error ? ' - ' + r.error : ''}`));
  return results;
}

// Fonction améliorée pour préparer les données de requête pour le replay
function prepareReplayData(requestData) {
  // Créer une copie pour éviter de modifier l'original
  const replayData = {
    url: requestData.url,
    method: requestData.method,
    headers: { ...requestData.headers } || {}
  };

  // Ajouter le Content-Type pour les requêtes Odoo
  if (requestData.url.includes('/web/dataset/call_kw/') || 
      requestData.url.includes('/jsonrpc') ||
      requestData.url.includes('/web/dataset/call')) {
    replayData.headers['Content-Type'] = 'application/json';
  }

  // Extraire le modèle et la méthode de l'URL pour les requêtes Odoo
  let model = '';
  let method = '';
  
  if (requestData.url.includes('/web/dataset/call_kw/')) {
    const urlParts = requestData.url.split('/');
    if (urlParts.length >= 6) {
      model = urlParts[urlParts.length - 2];
      method = urlParts[urlParts.length - 1];
    }
  }

  // Préparer le corps de la requête pour le replay
  if (requestData.requestBody) {
    replayData.body = requestData.requestBody;
  } else if (requestData.body) {
    replayData.body = requestData.body;
  } else {
    // Si pas de corps, créer un corps en fonction du type de méthode
    if (requestData.url.includes('/web/dataset/call_kw/')) {
      let args = [];
      let kwargs = {
        context: {
          lang: "en_US",
          tz: "UTC",
          uid: 2,
          allowed_company_ids: [1]
        }
      };
      
      // Adapter les arguments en fonction de la méthode
      if (method === 'name_search') {
        // Structure pour name_search: (name, args, operator, limit)
        args = [
          '', // Nom à rechercher (vide pour tout retourner)
          [], // Domaine (filtre)
          'ilike', // Opérateur
          10 // Limite
        ];
      } else if (method === 'onchange') {
        // Structure pour onchange
        args = [[], {}, [], {}];
      } else if (method === 'search_read') {
        // Structure pour search_read: (domain, fields, offset, limit, order)
        args = [
          [], // Domaine
          false, // Champs (false pour tous les champs)
          0, // Offset
          80, // Limite
          false // Ordre
        ];
      } else if (method === 'read') {
        // Structure pour read: (ids, fields)
        args = [
          [1], // IDs à lire
          [] // Champs (vide pour tous)
        ];
      } else if (method === 'create') {
        // Structure pour create: (values)
        args = [{}];
      } else if (method === 'write') {
        // Structure pour write: (ids, values)
        args = [[1], {}];
      } else {
        // Structure par défaut pour les autres méthodes
        args = [];
      }
      
      // Créer une structure Odoo avec les arguments adaptés
      replayData.body = {
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: kwargs
        },
        id: Math.floor(Math.random() * 100000)
      };
    }
  }

  return replayData;
}

// Helper function to execute a request
async function executeRequest(requestData) {
  try {
    const url = requestData.url;
    console.log(`Preparing to send ${requestData.method} request to ${url}`, requestData);
    
    // Les requêtes Odoo nécessitent un traitement spécial
    const isOdooRequest = url.includes('/web/dataset/call_kw/') || 
                          url.includes('/jsonrpc') ||
                          url.includes('/web/dataset/call');
    
    let headers = { ...requestData.headers } || {};
    let requestBody = null;
    
    // Détection et extraction du format OpenAPI - CORRECTION CRITIQUE
    if (requestData.body && requestData.body.content && 
        requestData.body.content["application/json"] && 
        requestData.body.content["application/json"].example) {
      
      // Format OpenAPI importé - extraire le corps réel
      console.log('Detected OpenAPI imported request format - extracting example body');
      // CORRECTION: Utiliser directement l'exemple sans l'enveloppe OpenAPI
      requestBody = JSON.parse(JSON.stringify(requestData.body.content["application/json"].example));
      
      console.log('Extracted body from OpenAPI format:', JSON.stringify(requestBody).substring(0, 200) + '...');
      console.log('Extracted request body "method" value:', requestBody.method); // Log crucial pour le débogage
    } else {
      // Format standard - utiliser requestBody ou body
      requestBody = requestData.requestBody || requestData.body || {};
    }
    
    // Pour les requêtes Odoo, toujours s'assurer que le Content-Type est correct
    if (isOdooRequest) {
      headers['Content-Type'] = 'application/json';
      console.log('Odoo request detected, using JSON format');
    }
    
    // Add diagnostic ping to check if host is reachable first
    try {
      const urlObj = new URL(url);
      const pingUrl = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
      await fetch(pingUrl, { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'manual'
      });
      console.log(`Host ping successful: ${urlObj.host}`);
    } catch (pingError) {
      console.warn(`Host ping failed, server may be unreachable: ${pingError.message}`);
    }
    
    // Prepare request options with better CORS handling
    const options = {
      method: requestData.method,
      headers: headers,
      mode: 'cors',
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-store'
    };
    
    // Remove problematic headers that might cause CORS issues
    if (options.headers) {
      const headersToRemove = ['origin', 'Origin', 'Referer', 'referer', 'host', 'Host'];
      headersToRemove.forEach(header => delete options.headers[header]);
      options.headers['X-Request-Source'] = 'Ark-Replayr-Extension';
    }
    
    // Maintenant, préparez le corps de la requête
    if (requestBody && Object.keys(requestBody).length > 0) {
      // Pour les requêtes Odoo
      if (isOdooRequest) {
        console.log('Preparing Odoo request body...');
        
        // CORRECTION: Vérification supplémentaire pour les formats OpenAPI
        if (requestBody.content && requestBody.content["application/json"] && requestBody.content["application/json"].example) {
          console.log('Nested OpenAPI structure detected - extracting inner example');
          requestBody = requestBody.content["application/json"].example;
        }
        
        // Si le corps a l'air d'être une structure complète de requête Odoo, utilisez-la directement
        if (requestBody.jsonrpc && requestBody.params) {
          console.log('Using complete Odoo JSON-RPC structure');
          // Préserver le champ method qui a peut-être été modifié par une substitution
          console.log(`Preserving method value: "${requestBody.method}"`);
          options.body = JSON.stringify(requestBody);
        } 
        // Si le corps a une structure partielle mais reconnaissable de requête Odoo
        else if ((requestBody.id || requestBody.params) && 
                typeof requestBody === 'object') {
          console.log('Detected partial Odoo structure, completing it');
          
          // Créer un squelette de requête Odoo complet
          let completeBody = {
            jsonrpc: "2.0",
            // CORRECTION: Utiliser la méthode du corps si disponible, sinon utiliser "call"
            method: requestBody.method || "call",
            id: requestBody.id || Math.floor(Math.random() * 100000)
          };
          
          console.log(`Using method value from request: "${completeBody.method}"`);
          
          // Extraire les paramètres Odoo de l'URL si nécessaire
          const urlParts = url.split('/');
          let model = '';
          let method = '';
          
          if (url.includes('/web/dataset/call_kw/')) {
            const pathParts = url.split('/');
            if (pathParts.length >= 6) {
              model = pathParts[pathParts.length - 2];
              method = pathParts[pathParts.length - 1];
            }
          }
          
          // Récupérer ou construire les params
          if (requestBody.params) {
            // Si params existe, utilisez-le tel quel
            completeBody.params = requestBody.params;
            
            // Mais assurez-vous que les champs obligatoires existent
            if (!completeBody.params.model) {
              completeBody.params.model = model || completeBody.params.model || '';
            }
            
            if (!completeBody.params.method) {
              completeBody.params.method = method || completeBody.params.method || '';
            }
            
            // Assurez-vous que args et kwargs existent
            if (!completeBody.params.args) {
              completeBody.params.args = [];
            }
            
            if (!completeBody.params.kwargs) {
              completeBody.params.kwargs = {
                context: {
                  lang: "en_US",
                  tz: "UTC",
                  uid: 2,
                  allowed_company_ids: [1]
                }
              };
            }
          } else {
            // Sinon, créer un objet params complet
            completeBody.params = {
              model: model,
              method: method,
              args: requestBody.args || [],
              kwargs: requestBody.kwargs || {
                context: {
                  lang: "en_US",
                  tz: "UTC",
                  uid: 2,
                  allowed_company_ids: [1]
                }
              }
            };
          }
          
          options.body = JSON.stringify(completeBody);
        } else {
          console.log('Using raw body for Odoo request');
          options.body = JSON.stringify(requestBody);
        }
        
        console.log('Final Odoo request body:', options.body);
      } 
      // Pour les requêtes non-Odoo
      else if (typeof requestBody === 'object') {
        options.body = JSON.stringify(requestBody);
      } else if (typeof requestBody === 'string') {
        options.body = requestBody;
      }
    } else {
      console.log('No request body provided');
      
      // Pour les requêtes Odoo sans corps, créer un corps minimal
      if (isOdooRequest) {
        const urlParts = url.split('/');
        const model = urlParts[urlParts.length - 2] || '';
        const method = urlParts[urlParts.length - 1] || '';
        
        // Structure adaptée selon la méthode
        let args = [];
        if (method === 'name_search') {
          args = ['', [], 'ilike', 10];  // name, args, operator, limit
        } else if (method === 'onchange') {
          args = [[], {}, [], {}];  // ids, values, fields, context
        } else if (method === 'web_search_read') {
          args = [[],false,0,80,false];  // domain, fields, offset, limit, order
        } else {
          args = [];  // generic fallback
        }
        
        const minimalBody = {
          jsonrpc: "2.0",
          method: "call",
          params: {
            model: model,
            method: method,
            args: args,
            kwargs: {
              context: {
                lang: "en_US",
                tz: "UTC",
                uid: 2,
                allowed_company_ids: [1]
              }
            }
          },
          id: Math.floor(Math.random() * 100000)
        };
        
        options.body = JSON.stringify(minimalBody);
        console.log('Using minimal fallback Odoo body structure:', options.body);
      }
    }
    
    // Try request with cors mode first
    try {
      console.log(`Sending ${requestData.method} request to ${url} with cors mode:`, options);
      const response = await fetch(url, options);
      const responseData = await processResponse(response);
      return responseData;
    } catch (corsError) {
      console.warn('CORS request failed, trying fallback approaches:', corsError.message);
      
      // For imported requests, provide more detailed diagnostics
      const isImportedRequest = requestData.importedFromOpenAPI || 
                              (requestData.originalPath && url !== requestData.originalPath);
      
      if (isImportedRequest) {
        console.log('CORS failure on imported request - this is expected for cross-origin requests');
        
        // For imported requests from OpenAPI, we'll return a simulated response
        return {
          status: 202,
          statusText: 'Imported Request - Limited Replay',
          importedRequest: true,
          headers: {},
          body: {
            note: 'This request was imported from an OpenAPI specification and cannot be fully executed due to browser security restrictions.',
            request_url: url,
            request_method: requestData.method,
            original_path: requestData.originalPath || '(unknown)',
          }
        };
      }
      
      // Only try no-cors for GET/HEAD methods
      if (requestData.method === 'GET' || requestData.method === 'HEAD') {
        try {
          options.mode = 'no-cors';
          console.log('Retrying with no-cors mode');
          const noCorsResponse = await fetch(url, options);
          
          return {
            status: 200,
            statusText: 'OK (No-CORS Mode - Limited Response)',
            headers: {},
            body: '[Response body unavailable in no-cors mode]',
            noCorsMode: true
          };
        } catch (noCorsError) {
          throw new Error(`Both cors and no-cors modes failed. Original error: ${corsError.message}, no-cors error: ${noCorsError.message}`);
        }
      } else {
        throw new Error(`CORS error for ${requestData.method} request to ${url}: ${corsError.message}. Browser security prevents cross-origin ${requestData.method} requests without proper CORS headers.`);
      }
    }
  } catch (error) {
    console.error(`Error executing request to ${requestData.url}:`, error);
    throw new Error(error.message);
  }
}

// Helper function to process a fetch response
async function processResponse(response) {
  const responseData = {
    status: response.status,
    statusText: response.statusText,
    headers: {}
  };
  
  // Convert headers to a plain object
  response.headers.forEach((value, key) => {
    responseData.headers[key] = value;
  });
  
  // Try to parse response body based on content type
  try {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData.body = await response.json();
    } else if (contentType && contentType.includes('text/')) {
      responseData.body = await response.text();
    } else {
      // For binary data or unknown types, just report content type
      responseData.body = `[Binary data or unsupported content type: ${contentType || 'unknown'}]`;
      
      // Try to get text anyway as a fallback
      try {
        const text = await response.text();
        if (text && text.length < 10000) { // Don't try to display huge binary responses
          responseData.body = text;
        }
      } catch (e) {
        // Ignore error in fallback
      }
    }
  } catch (error) {
    console.warn('Error parsing response body:', error);
    try {
      // Always try text as a final fallback
      responseData.body = await response.text();
    } catch (textError) {
      responseData.body = `[Could not read response body: ${error.message}]`;
    }
  }
  
  return responseData;
}

// Add missing utility function for URL handling
function isRelativeUrl(url) {
  // A URL is relative if it doesn't start with a protocol or a slash
  // This regex checks if the URL has a protocol like http:// or https://
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url);
  
  // Also considered absolute if it starts with a slash or double slash
  const isAbsolutePath = url.startsWith('/') || url.startsWith('//');
  
  return !hasProtocol && !isAbsolutePath;
}

// Convert recorded requests to OpenAPI 3.0 format
function convertToOpenAPI(requests) {
  logDebug('Converting to OpenAPI:', requests.length);
  
  // Create base OpenAPI spec structure
  const openAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Recorded API Requests',
      version: '1.0.0',
      description: 'Requests recorded by Network Request Recorder & Replay'
    },
    servers: [],
    paths: {},
    'x-original-urls': {},
    'x-recorded-data': {
      timestamp: new Date().toISOString(),
      requestCount: requests.length,
      originalCount: requests.length // Store original count for verification
    }
  };
  
  // Track hosts to group by server
  const hostMap = new Map();
  
  // Also track path usage to create unique paths
  const pathUsageCount = {};
  
  // First pass: collect all servers from all requests
  requests.forEach(request => {
    const fullUrl = request.url;
    if (!fullUrl) return;
    
    try {
      const urlObj = new URL(fullUrl);
      const serverUrl = `${urlObj.protocol}//${urlObj.host}`;
      
      if (!hostMap.has(serverUrl)) {
        hostMap.set(serverUrl, {
          url: serverUrl,
          description: `Server for ${urlObj.host}`
        });
      }
    } catch (e) {
      console.warn('Invalid URL:', fullUrl);
    }
  });
  
  // Add collected servers to the OpenAPI spec
  openAPISpec.servers = Array.from(hostMap.values());
  
  // If no servers were found, add a placeholder
  if (openAPISpec.servers.length === 0) {
    openAPISpec.servers.push({
      url: 'https://example.com',
      description: 'Example server (please replace with actual base URL)'
    });
  }
  
  // Second pass: process each request - INCLUDE ALL REQUESTS
  requests.forEach((request, index) => {
    const fullUrl = request.url;
    if (!fullUrl) return;
    
    const method = request.method?.toLowerCase() || 'get';
    
    // Extract URL components
    let urlObj, path, serverUrl, queryString = '';
    try {
      urlObj = new URL(fullUrl);
      path = urlObj.pathname;
      serverUrl = `${urlObj.protocol}//${urlObj.host}`;
      queryString = urlObj.search || '';
      
      // Ensure server exists in the spec
      if (!openAPISpec.servers.some(server => server.url === serverUrl)) {
        openAPISpec.servers.push({
          url: serverUrl,
          description: `Server for ${urlObj.host}`
        });
      }
    } catch (e) {
      console.warn('Invalid URL:', fullUrl);
      // For invalid URLs, create a dummy path to ensure request is still included
      path = `/invalid-url-${index}`;
      serverUrl = 'https://unknown-server.com';
    }
    
    // Create a base path key that includes method
    let basePathKey = `${path}`;
    
    // Include a condensed query string in the path key for uniqueness
    // but keep it reasonable in length
    if (queryString) {
      // Create a shortened query fingerprint
      let queryFingerprint = queryString;
      if (queryString.length > 30) {
        // Take first 30 characters of query string and add hash
        const hash = hashCode(queryString).toString(16).slice(0, 8);
        queryFingerprint = `${queryString.substring(0, 30)}_${hash}`;
      }
      basePathKey += queryFingerprint.replace(/[&?=]/g, '_');
    }
    
    // Track usage count for this path and ensure uniqueness
    pathUsageCount[basePathKey] = (pathUsageCount[basePathKey] || 0) + 1;
    const instanceNum = pathUsageCount[basePathKey];
    
    // Create unique path key with instance number if needed
    const uniquePathKey = instanceNum > 1 
      ? `${basePathKey}_instance${instanceNum}` 
      : basePathKey;
    
    // Initialize path entry
    if (!openAPISpec.paths[uniquePathKey]) {
      openAPISpec.paths[uniquePathKey] = {};
    }
    
    // Store the original URL for reference with the unique key
    openAPISpec['x-original-urls'][`${method}-${uniquePathKey}`] = fullUrl;
    
    // Parse query parameters if URL is valid
    const queryParams = [];
    if (urlObj) {
      urlObj.searchParams.forEach((value, key) => {
        queryParams.push({
          name: key,
          in: 'query',
          schema: { type: 'string' },
          example: value,
          description: `Query parameter from recorded request`
        });
      });
    }
    
    // Extract request headers
    const headerParams = [];
    if (request.requestHeaders) {
      // Handle both array and object format for headers
      const headers = Array.isArray(request.requestHeaders) ? 
        request.requestHeaders : 
        Object.entries(request.requestHeaders).map(([name, value]) => ({ name, value }));
      
      headers.forEach(header => {
        const name = header.name || Object.keys(header)[0];
        const value = header.value || header[name];
        
        // Skip certain headers that shouldn't be replayed
        if (!['content-length', 'host', 'connection'].includes(name.toLowerCase())) {
          headerParams.push({
            name: name,
            in: 'header',
            schema: { type: 'string' },
            example: value,
            description: `Header from recorded request`
          });
        }
      });
    }
    
    // Create a sanitized operation ID from method and path
    // Ensure the operationId is unique by always including the request index
    const sanitizedPath = uniquePathKey.replace(/[^\w\d]/g, '_').replace(/_+/g, '_');
    const operationId = `${method}${sanitizedPath}_${index}`;
    
    // Create operation object with all parameters
    openAPISpec.paths[uniquePathKey][method] = {
      summary: `${method.toUpperCase()} ${path}${instanceNum > 1 ? ` (Instance ${instanceNum})` : ''}`,
      description: `Recorded ${method.toUpperCase()} request to ${fullUrl}`,
      operationId: operationId,
      parameters: [...queryParams, ...headerParams],
      responses: {
        '200': {
          description: 'Successful operation'
        }
      },
      // Store full URL as extension property for proper replay
      'x-original-url': fullUrl,
      // Store original index to maintain order
      'x-recorded-index': index,
      // Store additional metadata for complete replay
      'x-recorded-metadata': {
        id: request.id || `req-${index}`,
        type: request.type || 'xhr',
        isXhr: request.type === 'xmlhttprequest',
        isAsset: /\.(js|css|png|jpg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/i.test(fullUrl),
        statusCode: request.statusCode,
        timestamp: request.timeStamp || Date.now(),
        query: queryString,
        instanceNumber: instanceNum
      }
    };
    
    // Add request body if applicable
    if (request.requestBody && (method === 'post' || method === 'put' || method === 'patch' || method === 'delete')) {
      let contentType = 'application/json';
      let example = request.requestBody;
      
      // Try to determine content type from headers
      if (request.requestHeaders) {
        // Handle both array and object formats
        let headers = request.requestHeaders;
        if (Array.isArray(headers)) {
          const contentTypeHeader = headers.find(h => 
            (h.name && h.name.toLowerCase() === 'content-type') || 
            Object.keys(h).some(k => k.toLowerCase() === 'content-type')
          );
          
          if (contentTypeHeader) {
            contentType = contentTypeHeader.value || contentTypeHeader['content-type'] || contentTypeHeader['Content-Type'];
          }
        } else {
          const contentTypeHeader = Object.keys(headers)
            .find(key => key.toLowerCase() === 'content-type');
          if (contentTypeHeader) {
            contentType = headers[contentTypeHeader];
          }
        }
      }
      
      // Try to parse JSON bodies
      if (contentType.includes('application/json') && typeof example === 'string') {
        try {
          example = JSON.parse(example);
        } catch (e) {
          // Keep as string if parsing fails
          console.warn('Failed to parse JSON body:', e);
        }
      }
      
      openAPISpec.paths[uniquePathKey][method].requestBody = {
        content: {
          [contentType]: {
            schema: {
              type: contentType.includes('json') ? 'object' : 'string'
            },
            example: example
          }
        }
      };
    }
    
    // Add variable capture if configured
    if (request.variableCapture && request.variableCapture.length > 0) {
      openAPISpec.paths[uniquePathKey][method]['x-variable-capture'] = request.variableCapture;
    }
    
    // Add response headers if available
    if (request.responseHeaders) {
      openAPISpec.paths[uniquePathKey][method]['x-response-headers'] = request.responseHeaders;
    }
  });
  
  // Add metadata to help the import process recognize this as a recorded set
  openAPISpec['x-ark-replayr'] = {
    version: '1.0.0',
    type: 'recording',
    exportedAt: new Date().toISOString(),
    requestTypes: {
      allRequests: true, // Flag indicating all requests are included
      includesAssets: true
    }
  };
  
  // Verify we have the same number of operations as requests
  // Count total operations across all paths
  let operationCount = 0;
  Object.values(openAPISpec.paths).forEach(pathItem => {
    operationCount += Object.keys(pathItem).length;
  });
  
  if (operationCount < requests.length) {
    console.warn(`Warning: Only ${operationCount} operations in export from ${requests.length} requests. Some requests may still be missing.`);
  } else {
    console.log(`Successfully exported all ${requests.length} requests as ${operationCount} operations.`);
  }
  
  return openAPISpec;
}

// Simple string hash function to create fingerprints
function hashCode(str) {
  let hash = 0;
  for (let i = 0; str && i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Add these new functions for live replay with tracking

// Variable to store replay state
let isLiveReplaying = false;
let liveReplaySteps = [];
let currentStepIndex = -1;
let replayOptions = {};

// New function to start replay with tracking
async function startReplayWithTracking(steps, options) {
  isLiveReplaying = true;
  liveReplaySteps = steps;
  currentStepIndex = -1;
  replayOptions = options || {};
  
  logDebug('Starting replay with tracking', { steps: steps.length, options });
  console.log('Replay options:', JSON.stringify(replayOptions)); // Ajout de log pour l'option errorOnCapture
  
  // Execute each step and update progress
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Skip if configured
    if (step.skip) {
      updateReplayProgress(i, 'skipped');
      continue;
    }
    
    // Mark as in progress
    currentStepIndex = i;
    updateReplayProgress(i, 'in-progress');
    
    try {
      // Process variable substitution
      const processedRequest = processVariableSubstitution(step, capturedVariables);
      
      // Send request details
      updateReplayProgress(i, 'in-progress', { request: processedRequest });
      
      // Execute the request
      const response = await executeRequest(processedRequest);
      
      // Process variable capture
      let capturedVars = {};
      if (step.variableCaptures && step.variableCaptures.length > 0) {
        capturedVars = processStepVariableCapture(response, step.variableCaptures);
        
        // Log pour déboguer la condition errorOnCapture
        console.log('Variables capturées:', Object.keys(capturedVars).length, 'Option errorOnCapture:', replayOptions.errorOnCapture);
        
        // Vérifier si des variables ont été capturées et si errorOnCapture est activé
        if (Object.keys(capturedVars).length > 0 && replayOptions.errorOnCapture === true) {
          logDebug('Variables captured and errorOnCapture is enabled', capturedVars);
          console.log('ERREUR CAPTURE: Variables capturées alors que errorOnCapture est activé');
          
          // Marquer comme erreur si errorOnCapture est activé et des variables ont été capturées
          updateReplayProgress(i, 'error', { 
            request: processedRequest,
            response: response,
            capturedVariables: capturedVars,
            error: 'Variables capturées alors que errorOnCapture est activé',
            status: 'error' // Ajouter explicitement le statut d'erreur
          });
          
          // Si stopOnError est aussi activé, arrêter le replay
          if (replayOptions.stopOnError) {
            break;
          }
          
          // Passer à l'étape suivante sans exécuter le code ci-dessous
          continue;
        }
      }
      
      // Send success status
      updateReplayProgress(i, 'success', { 
        request: processedRequest,
        response: response,
        capturedVariables: capturedVars
      });
    } catch (error) {
      // Send error status
      updateReplayProgress(i, 'error', { error: error.message });
      
      // Stop if configured to stop on error
      if (replayOptions.stopOnError) {
        break;
      }
    }
  }
  
  // Mark as complete
  isLiveReplaying = false;
  updateReplayProgress(-1, 'complete');
  
  return { status: 'Replay completed', steps: liveReplaySteps };
}

// Function to stop live replay
function stopLiveReplay() {
  isLiveReplaying = false;
  return { status: 'Replay stopped manually' };
}

// Helper function to update replay progress
function updateReplayProgress(stepIndex, status, data = {}) {
  // Create progress data object
  const progressData = {
    stepIndex,
    status,
    timestamp: Date.now(),
    ...data
  };
  
  // Send progress update to window manager
  chrome.runtime.sendMessage({
    action: 'updateReplayProgress',
    progressData
  });
  
  // Save progress data to storage for the replay window to access
  chrome.storage.local.set({
    replayProgress: progressData,
    replayProgressTimestamp: Date.now()
  });
  
  return { success: true };
}

// Helper function to safely send messages to tabs with retry mechanism
function safelySendTabMessage(tabId, message, callback = null, retries = 3) {
  // Utiliser la version importée si disponible
  if (importedSafelySendTabMessage) {
    return importedSafelySendTabMessage(tabId, message, callback, retries);
  }
  
  // Fallback si l'import a échoué
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(`Error sending message to tab ${tabId}:`, chrome.runtime.lastError.message);
      
      // If we have retries left, try again after a delay
      if (retries > 0) {
        setTimeout(() => {
          safelySendTabMessage(tabId, message, callback, retries - 1);
        }, 500);
      } else if (callback) {
        callback({ error: chrome.runtime.lastError.message });
      }
    } else if (callback) {
      callback(response);
    }
  });
}

// Helper function to check restricted URLs without relying on external utility
function checkRestrictedUrl(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://', 
    'chrome-extension://', 
    'devtools://',
    'chrome-devtools://', 
    'view-source:',
    'about:',
    'file://'
  ];
  
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Fallback for ensuring content script is loaded
function ensureContentScriptLoaded(tabId, callback) {
  // Utiliser la version importée si disponible
  if (importedEnsureContentScriptLoaded) {
    return importedEnsureContentScriptLoaded(tabId, callback);
  }
  
  // Fallback implementation
  let attempts = 0;
  const maxAttempts = 3;
  
  function tryInjectContentScript() {
    attempts++;
    console.log(`Ensuring content script is loaded (attempt ${attempts}/${maxAttempts})`);
    
    try {
      chrome.tabs.sendMessage(tabId, { action: 'pingContentScript' }, response => {
        if (chrome.runtime.lastError) {
          console.log(`Content script not ready (attempt ${attempts}/${maxAttempts}): ${chrome.runtime.lastError.message}`);
          
          if (attempts < maxAttempts) {
            // Try to inject the content script
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content-script.js']
            }).then(() => {
              console.log(`Content script injected on attempt ${attempts}`);
              // Wait a moment for the script to initialize
              setTimeout(tryInjectContentScript, 300);
            }).catch(err => {
              console.error(`Error injecting content script (attempt ${attempts}/${maxAttempts}):`, err);
              if (attempts < maxAttempts) {
                setTimeout(tryInjectContentScript, 300);
              } else {
                console.error('Content script unavailable after', maxAttempts, 'attempts');
                callback(false);
              }
            });
          } else {
            console.error('Content script unavailable after', maxAttempts, 'attempts');
            callback(false);
          }
        } else {
          console.log('Content script is responsive:', response);
          callback(true);
        }
      });
    } catch (error) {
      console.error('Exception checking content script status:', error);
      if (attempts < maxAttempts) {
        setTimeout(tryInjectContentScript, 300);
      } else {
        callback(false);
      }
    }
  }
  
  tryInjectContentScript();
}

// Use getGlobal to safely access global objects
function safelyGetGlobal(name) {
  // Replace the reference to globalRef with a direct check
  // This fixes the "ReferenceError: globalRef is not defined" error
  
  // First try service worker global scope
  if (typeof self !== 'undefined' && self[name]) {
    return self[name];
  }
  
  // Then try window object (though this is unlikely in a background script)
  if (typeof window !== 'undefined' && window[name]) {
    return window[name];
  }
  
  // Check if there's a globalContext variable available
  if (typeof globalContext !== 'undefined' && globalContext[name]) {
    return globalContext[name];
  }
  
  // Return null if not found
  return null;
}

// Fallback function to check restricted URLs
function isRestrictedUrlFallback(url) {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome://', 
    'chrome-extension://', 
    'devtools://',
    'chrome-devtools://', 
    'view-source:',
    'about:',
    'file://'
  ];
  
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Ensure tab management functions are defined directly in this file as fallbacks
if (typeof openReplayTab !== 'function') {
  function openReplayTab(replayData, callback) {
    console.log('Using fallback openReplayTab function');
    try {
      // Save data to storage
      chrome.storage.local.set({
        replayWindowData: replayData,
        isLiveReplay: true,
        dataTimestamp: Date.now()
      }, () => {
        // Create the tab
        chrome.tabs.create({
          url: chrome.runtime.getURL("index.html?page=replay-window"),
          active: true
        }, (tab) => {
          if (callback) callback({ success: true, tabId: tab.id });
        });
      });
    } catch (error) {
      console.error('Error in fallback openReplayTab:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  }
}

if (typeof openAdvancedTab !== 'function') {
  function openAdvancedTab(tab = 'record', callback) {
    console.log('Using fallback openAdvancedTab function', tab);
    try {
      chrome.tabs.create({
        url: chrome.runtime.getURL(`index.html?tab=${tab}`),
        active: true
      }, (newTab) => {
        if (callback) callback({ success: true, tabId: newTab.id });
      });
    } catch (error) {
      console.error('Error in fallback openAdvancedTab:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  }
}

// Helper function for variable substitution
function processVariableSubstitution(step, variables) {
  // Clone the step to avoid modifying the original
  const processedStep = JSON.parse(JSON.stringify(step));
  
  console.log('[VAR-SUB] Starting variable substitution for step:', 
    processedStep.name || processedStep.url, 
    'with substitutions:', processedStep.variableSubstitutions?.length || 0, 
    'variables available:', Object.keys(variables || {}).length);
  
  // Traiter en premier les requêtes spéciales Odoo au format OpenAPI
  const isOdooOpenApiRequest = 
    processedStep.requestBody && 
    typeof processedStep.requestBody === 'object' &&
    processedStep.requestBody.content && 
    processedStep.requestBody.content['application/json'] && 
    processedStep.requestBody.content['application/json'].example;
  
  // Cas spécial pour les requêtes Odoo au format OpenAPI
  if (isOdooOpenApiRequest && processedStep.variableSubstitutions) {
    console.log('[VAR-SUB] Detected Odoo request in OpenAPI format - using special handling');
    
    // Extraire l'exemple pour y appliquer les substitutions
    const example = processedStep.requestBody.content['application/json'].example;
    
    // Parcourir toutes les substitutions et utiliser applySmartJsonSubstitution
    for (const substitution of (processedStep.variableSubstitutions || [])) {
      try {
        if (!substitution.regex) continue;
        
        // Déterminer la valeur de remplacement
        let replacementValue = '';
        if (substitution.mode === 'fixed' && substitution.value) {
          replacementValue = substitution.value;
          console.log(`[VAR-SUB] Using fixed value: "${replacementValue}" for pattern: ${substitution.regex}`);
        } else if (substitution.targetVariable && variables) {
          const varValue = variables[substitution.targetVariable];
          replacementValue = (varValue !== undefined && varValue !== null) ? varValue : '0';
          console.log(`[VAR-SUB] Using variable value: "${replacementValue}" (default: 0) for variable: ${substitution.targetVariable}`);
        }
        
        if (replacementValue !== '') {
          // NOUVELLE APPROCHE: Utiliser applySmartJsonSubstitution pour toutes les substitutions
          const success = applySmartJsonSubstitution(example, substitution.regex, replacementValue);
          
          if (success) {
            console.log(`[VAR-SUB] Smart substitution successful for pattern: ${substitution.regex}`);
            continue; // Passer à la substitution suivante
          }
          
          // Si la substitution intelligente a échoué, essayer les cas spéciaux existants
          
          // Cas spécial pour "method":"call" au niveau supérieur
          if (substitution.regex.includes('method') && substitution.regex.includes('call') && 
              !substitution.regex.includes('params')) {
            if (example && example.method === 'call') {
              console.log(`[VAR-SUB] Direct replacement of method field: "call" -> "${replacementValue}"`);
              example.method = replacementValue;
              continue;
            }
          }
          
          // Cas spécial pour la méthode dans params (onchange)
          if (substitution.regex.includes('params') && 
              substitution.regex.includes('method') && 
              example && example.params && example.params.method) {
              
            // Vérifier si on cherche à remplacer "onchange" ou une autre méthode spécifique
            const methodMatch = substitution.regex.match(/"method"\s*:\s*"(\w+)"/);
            const targetMethod = methodMatch ? methodMatch[1] : null;
            
            if (!targetMethod || example.params.method === targetMethod) {
              console.log(`[VAR-SUB] Direct replacement of params.method field: "${example.params.method}" -> "${replacementValue}"`);
              example.params.method = replacementValue;
              continue;
            }
          }
          
          // Cas spécial pour res_partner_search_mode dans le contexte
          if (substitution.regex.includes('res_partner_search_mode') && 
              example && example.params && example.params.kwargs && 
              example.params.kwargs.context) {
              
            // Vérifier si on cherche à remplacer une valeur spécifique de res_partner_search_mode
            const modeMatch = substitution.regex.match(/"res_partner_search_mode"\s*:\s*"([^"]*)"/);
            const targetMode = modeMatch ? modeMatch[1] : null;
            const currentMode = example.params.kwargs.context.res_partner_search_mode;
            
            if (!targetMode || (currentMode && currentMode === targetMode)) {
              console.log(`[VAR-SUB] Direct replacement of res_partner_search_mode: "${currentMode}" -> "${replacementValue}"`);
              // S'assurer que la structure existe avant de remplacer
              if (!example.params.kwargs.context) {
                example.params.kwargs.context = {};
              }
              example.params.kwargs.context.res_partner_search_mode = replacementValue;
              continue;
            }
          }
          
          // Cas spécial pour le champ "name" dans les requêtes name_search
          if (substitution.regex.includes('"name"') && 
              example && example.params && example.params.kwargs && 
              example.params.method === 'name_search') {
              
            // Vérifier si on cherche à remplacer une valeur spécifique du champ name
            const nameMatch = substitution.regex.match(/"name"\s*:\s*"([^"]*)"/);
            const targetName = nameMatch ? nameMatch[1] : null;
            const currentName = example.params.kwargs.name;
            
            if (!targetName || (currentName !== undefined && currentName === targetName)) {
              console.log(`[VAR-SUB] Direct replacement of name field: "${currentName}" -> "${replacementValue}"`);
              // S'assurer que la structure kwargs existe avant de remplacer
              if (!example.params.kwargs) {
                example.params.kwargs = {};
              }
              example.params.kwargs.name = replacementValue;
              continue;
            }
          }
          
          // Cas spécial pour le champ "tz" dans le contexte des requêtes Odoo
          if (substitution.regex.includes('"tz"') && 
              example && example.params && example.params.kwargs && 
              example.params.kwargs.context) {
              
            // Vérifier si on cherche à remplacer une valeur spécifique du champ tz
            const tzMatch = substitution.regex.match(/"tz"\s*:\s*"([^"]*)"/);
            const targetTz = tzMatch ? tzMatch[1] : null;
            const currentTz = example.params.kwargs.context.tz;
            
            if (!targetTz || (currentTz !== undefined && currentTz === targetTz)) {
              console.log(`[VAR-SUB] Direct replacement of tz field: "${currentTz}" -> "${replacementValue}"`);
              // S'assurer que la structure context existe avant de remplacer
              if (!example.params.kwargs.context) {
                example.params.kwargs.context = {};
              }
              example.params.kwargs.context.tz = replacementValue;
              continue;
            }
          }
          
          // Cas spécial pour le champ "uid" dans le contexte
          if (substitution.regex.includes('"uid"') || substitution.regex.includes('uid') && 
              example && example.params && example.params.kwargs && 
              example.params.kwargs.context) {
              
            // Vérifier si on cherche à remplacer une valeur spécifique du champ uid
            const uidMatch = substitution.regex.match(/"uid"\s*:\s*(\d+)/);
            const targetUid = uidMatch ? parseInt(uidMatch[1]) : null;
            const currentUid = example.params.kwargs.context.uid;
            
            if (!targetUid || (currentUid !== undefined && currentUid === targetUid)) {
              // Convertir en nombre si possible
              let newUid = replacementValue;
              if (!isNaN(parseInt(replacementValue))) {
                newUid = parseInt(replacementValue);
              }
              
              console.log(`[VAR-SUB] Direct replacement of uid field: "${currentUid}" -> "${newUid}"`);
              // S'assurer que la structure context existe avant de remplacer
              if (!example.params.kwargs.context) {
                example.params.kwargs.context = {};
              }
              example.params.kwargs.context.uid = newUid;
              continue;
            }
          }
          
          // Cas spécial pour le champ "lang" dans le contexte
          if (substitution.regex.includes('"lang"') && 
              example && example.params && example.params.kwargs && 
              example.params.kwargs.context) {
              
            // Vérifier si on cherche à remplacer une valeur spécifique du champ lang
            const langMatch = substitution.regex.match(/"lang"\s*:\s*"([^"]*)"/);
            const targetLang = langMatch ? langMatch[1] : null;
            const currentLang = example.params.kwargs.context.lang;
            
            if (!targetLang || (currentLang !== undefined && currentLang === targetLang)) {
              console.log(`[VAR-SUB] Direct replacement of lang field: "${currentLang}" -> "${replacementValue}"`);
              // S'assurer que la structure context existe avant de remplacer
              if (!example.params.kwargs.context) {
                example.params.kwargs.context = {};
              }
              example.params.kwargs.context.lang = replacementValue;
              continue;
            }
          }
          
          // Autres cas : convertir en chaîne et appliquer la regex
          const exampleStr = JSON.stringify(example);
          
          // Appliquer la regex de façon safe pour les structures JSON
          let modifiedStr = exampleStr;
          try {
            // Cas spécial pour le regex de params.method qui peut casser le JSON
            if (substitution.regex.includes('params') && substitution.regex.includes('method')) {
              const regex = new RegExp(substitution.regex);
              const matches = regex.exec(exampleStr);
              
              if (matches && matches.length > 1) {
                // Capturer la partie qu'on veut remplacer
                const originalMethod = matches[1];
                
                // Remplacer de façon sécurisée
                const jsonObj = JSON.parse(exampleStr);
                if (jsonObj.params && jsonObj.params.method === originalMethod) {
                  jsonObj.params.method = replacementValue;
                  modifiedStr = JSON.stringify(jsonObj);
                  console.log(`[VAR-SUB] Safely replaced params.method: "${originalMethod}" -> "${replacementValue}"`);
                }
              } else {
                // Appliquer normalement si pas de capture
                modifiedStr = exampleStr.replace(new RegExp(substitution.regex, 'g'), 
                  (match) => match.replace(/"method"\s*:\s*"[^"]+"/, `"method":"${replacementValue}"`));
              }
            } 
            // Cas spécial pour res_partner_search_mode
            else if (substitution.regex.includes('res_partner_search_mode')) {
              const regex = new RegExp(substitution.regex);
              const matches = regex.exec(exampleStr);
              
              if (matches && matches.length > 1) {
                // Capturer la partie qu'on veut remplacer
                const originalMode = matches[1];
                
                // Remplacer de façon sécurisée en utilisant la structure d'objets
                const jsonObj = JSON.parse(exampleStr);
                if (jsonObj.params && jsonObj.params.kwargs && jsonObj.params.kwargs.context) {
                  if (jsonObj.params.kwargs.context.res_partner_search_mode === originalMode) {
                    jsonObj.params.kwargs.context.res_partner_search_mode = replacementValue;
                    modifiedStr = JSON.stringify(jsonObj);
                    console.log(`[VAR-SUB] Safely replaced res_partner_search_mode: "${originalMode}" -> "${replacementValue}"`);
                  }
                }
              } else {
                // Remplacer de façon sécurisée pour éviter de casser le JSON
                modifiedStr = exampleStr.replace(new RegExp(substitution.regex, 'g'), 
                  (match) => match.replace(/"res_partner_search_mode"\s*:\s*"[^"]+"/, 
                  `"res_partner_search_mode":"${replacementValue}"`));
              }
            }
            else {
              // Regex standard pour les autres cas
              const regex = new RegExp(substitution.regex, 'g');
              modifiedStr = exampleStr.replace(regex, replacementValue);
            }
          } catch (regexError) {
            console.error('[VAR-SUB] Error applying regex:', regexError);
            // Continuer avec la chaîne originale
            modifiedStr = exampleStr;
          }
          
          if (modifiedStr !== exampleStr) {
            try {
              // Si la substitution a réussi, mettre à jour l'exemple
              processedStep.requestBody.content['application/json'].example = JSON.parse(modifiedStr);
              console.log(`[VAR-SUB] Applied substitution: "${substitution.regex}" -> "${replacementValue}"`);
            } catch (parseError) {
              console.error('[VAR-SUB] Error parsing JSON after substitution:', parseError);
              // En cas d'erreur, essayer de faire un remplacement plus ciblé
              try {
                // Approche directe pour params.method
                if (substitution.regex.includes('params') && 
                    substitution.regex.includes('method') && 
                    example.params && example.params.method) {
                  example.params.method = replacementValue;
                  console.log(`[VAR-SUB] Fallback: direct replacement of params.method after parse error`);
                } 
                // Approche directe pour method
                else if (substitution.regex.includes('method') && 
                        !substitution.regex.includes('params') && 
                        example.method) {
                  example.method = replacementValue;
                  console.log(`[VAR-SUB] Fallback: direct replacement of method field after parse error`);
                }
                // Approche directe pour res_partner_search_mode
                else if (substitution.regex.includes('res_partner_search_mode') && 
                        example.params && example.params.kwargs && 
                        example.params.kwargs.context) {
                  example.params.kwargs.context.res_partner_search_mode = replacementValue;
                  console.log(`[VAR-SUB] Fallback: direct replacement of res_partner_search_mode after parse error`);
                }
              } catch (e) {
                console.error('[VAR-SUB] Error in fallback replacement:', e);
              }
            }
          } else {
            console.log(`[VAR-SUB] No matches found for pattern: ${substitution.regex}`);
          }
        }
      } catch (e) {
        console.error('[VAR-SUB] Error applying substitution:', e);
      }
    }
    
    return processedStep;
  }
  
  // Process URL - replace any ${variableName} with the actual value
  if (processedStep.url) {
    const originalUrl = processedStep.url;
    processedStep.url = replaceVariables(processedStep.url, variables, processedStep.variableSubstitutions);
    if (originalUrl !== processedStep.url) {
      console.log(`[VAR-SUB] URL modified: ${originalUrl} -> ${processedStep.url}`);
    }
  }
  
  // Process request headers
  if (processedStep.requestHeaders) {
    for (const [key, value] of Object.entries(processedStep.requestHeaders)) {
      if (typeof value === 'string') {
        const originalValue = processedStep.requestHeaders[key];
        processedStep.requestHeaders[key] = replaceVariables(value, variables, processedStep.variableSubstitutions);
        if (originalValue !== processedStep.requestHeaders[key]) {
          console.log(`[VAR-SUB] Header '${key}' modified: ${originalValue} -> ${processedStep.requestHeaders[key]}`);
        }
      }
    }
  }
  
  // Process request body with special handling for Odoo requests
  if (processedStep.requestBody) {
    // Standard processing for non-OpenAPI Odoo requests
    if (typeof processedStep.requestBody === 'string') {
      // Standard string body processing
      const originalBody = processedStep.requestBody;
      processedStep.requestBody = replaceVariables(processedStep.requestBody, variables, processedStep.variableSubstitutions);
      if (originalBody !== processedStep.requestBody) {
        console.log(`[VAR-SUB] String body modified: "${originalBody.substring(0, 50)}..." -> "${processedStep.requestBody.substring(0, 50)}..."`);
      }
    } else if (typeof processedStep.requestBody === 'object') {
      // For JSON bodies, use safe approach for object manipulation
      try {
        const bodyStr = JSON.stringify(processedStep.requestBody);
        const processedBodyStr = replaceVariables(bodyStr, variables, processedStep.variableSubstitutions);
        
        // Only parse if substitutions were actually made
        if (bodyStr !== processedBodyStr) {
          console.log('[VAR-SUB] JSON body modified, parsing back to object');
          try {
            processedStep.requestBody = JSON.parse(processedBodyStr);
          } catch (parseError) {
            console.error('[VAR-SUB] Error processing JSON request body:', parseError);
          }
        }
      } catch (error) {
        console.error('[VAR-SUB] Error processing request body:', error);
      }
    }
  }
  
  console.log('[VAR-SUB] Completed variable substitution for step:', processedStep.name || processedStep.url);
  return processedStep;
  
  // Helper function to replace variables in a string
  function replaceVariables(text, variables, substitutions) {
    if (!text) return text;
    let processedText = text;
    
    // Process step-level substitutions if available
    if (substitutions && substitutions.length > 0) {
      console.log('[VAR-SUB] Processing explicit substitutions:', substitutions.length);
      
      for (const substitution of substitutions) {
        try {
          if (!substitution.regex) {
            console.log('[VAR-SUB] Skipping substitution with no regex pattern');
            continue;
          }
          
          let replacementValue = '';
          if (substitution.mode === 'fixed' && substitution.value) {
            // Use fixed value
            replacementValue = substitution.value;
            console.log(`[VAR-SUB] Using fixed value: "${replacementValue}" for pattern: ${substitution.regex}`);
          } else if (substitution.targetVariable) {
            // Use variable from previous steps or default to 0
            const varValue = variables[substitution.targetVariable];
            replacementValue = (varValue !== undefined && varValue !== null) ? varValue : '0';
            console.log(`[VAR-SUB] Using variable value: "${replacementValue}" (default: 0) for variable: ${substitution.targetVariable}, pattern: ${substitution.regex}`);
          }
          
          if (replacementValue !== '') {
            // Standard regex replacement
            const regex = new RegExp(substitution.regex, 'g');
            const tempText = processedText.replace(regex, replacementValue);
            
            // Check if anything was actually replaced
            if (tempText !== processedText) {
              console.log(`[VAR-SUB] Applied substitution: "${substitution.regex}" -> "${replacementValue}"`);
              processedText = tempText;
            } else {
              console.log(`[VAR-SUB] No matches found for pattern: ${substitution.regex}`);
            }
          }
        } catch (e) {
          console.error('[VAR-SUB] Error applying substitution:', e, substitution);
        }
      }
    }
    
    // Process traditional ${var} style variables as fallback
    if (variables) {
      console.log('[VAR-SUB] Processing traditional ${var} style variables');
      for (const [name, value] of Object.entries(variables)) {
        if (value) {
          try {
            const regex = new RegExp(`\\$\\{${name}\\}`, 'g');
            const tempText = processedText.replace(regex, value);
            if (tempText !== processedText) {
              console.log(`[VAR-SUB] Replaced ${name} with "${value}"`);
              processedText = tempText;
            }
          } catch (e) {
            console.error('[VAR-SUB] Error applying traditional variable:', e, name, value);
          }
        }
      }
    }
    
    return processedText;
  }
}

// Helper function for capturing variables from a response
function processStepVariableCapture(response, captureConfigs) {
  const capturedVars = {};
  let missingRequiredVars = []; // Nouvelle variable pour suivre les variables obligatoires manquantes
  
  if (!response || !captureConfigs || !captureConfigs.length) {
    return { capturedVars, missingRequiredVars }; // Retourner aussi les variables manquantes
  }
  
  for (const config of captureConfigs) {
    try {
      const { name, regex, source, required, failOnError } = config;
      if (!name || !regex) continue;
      
      let sourceText = '';
      
      // Get the appropriate source text based on configuration
      switch (source) {
        case 'responseBody':
        case 'body':
          if (typeof response.body === 'string') {
            sourceText = response.body;
          } else if (response.body) {
            sourceText = JSON.stringify(response.body);
          }
          break;
          
        case 'responseHeaders':
        case 'headers':
          if (response.headers) {
            sourceText = JSON.stringify(response.headers);
          }
          break;
          
        case 'url':
          sourceText = response.url || '';
          break;
          
        default:
          // Default to response body
          if (typeof response.body === 'string') {
            sourceText = response.body;
          } else if (response.body) {
            sourceText = JSON.stringify(response.body);
          }
      }
      
      // Apply regex to extract the value
      const regexPattern = new RegExp(regex);
      const match = regexPattern.exec(sourceText);
      
      if (match && match[1]) {
        capturedVars[name] = match[1];
        
        // Store captured variable globally
        capturedVariables[name] = match[1];
        console.log(`Captured variable ${name} = ${match[1]}`);
      } else if (required) {
        console.warn(`Required variable ${name} could not be captured using regex: ${regex}`);
        // Ajouter cette variable à la liste des variables obligatoires manquantes
        missingRequiredVars.push({ name, regex });
      }
    } catch (error) {
      console.error(`Error capturing variable ${config.name}:`, error);
    }
  }
  
  return { capturedVars, missingRequiredVars }; // Retourner les deux résultats
}

/**
 * Recherche et remplace une valeur dans un objet JSON en utilisant une analyse intelligente de regex
 * @param {Object} obj - L'objet JSON à modifier
 * @param {string} regex - Expression régulière qui contient le nom du champ
 * @param {string|number} newValue - Nouvelle valeur à appliquer
 * @returns {boolean} - True si au moins une modification a été effectuée
 */
function applySmartJsonSubstitution(obj, regex, newValue) {
  if (!obj || typeof obj !== 'object' || !regex) return false;
  
  // Extraire le nom du champ à partir de la regex
  // Format 1: "field": "value" - pour les champs avec valeurs string
  // Format 2: "field": number - pour les champs avec valeurs numériques
  let fieldName = null;
  let expectedValue = null;
  let isNumericValue = false;
  
  // Tentative d'extraction pour format "field":"value" (chaînes)
  const stringFieldMatch = regex.match(/"([^"]+)"\s*:\s*"([^"]*)"/);
  if (stringFieldMatch && stringFieldMatch.length > 1) {
    fieldName = stringFieldMatch[1];
    if (stringFieldMatch.length > 2) {
      expectedValue = stringFieldMatch[2]; 
    }
  } 
  // Tentative d'extraction pour format "field":number (nombres)
  else {
    const numericFieldMatch = regex.match(/"([^"]+)"\s*:\s*(\d+)/);
    if (numericFieldMatch && numericFieldMatch.length > 1) {
      fieldName = numericFieldMatch[1];
      if (numericFieldMatch.length > 2) {
        expectedValue = numericFieldMatch[2];
        isNumericValue = true;
      }
    }
    // Fallback: Juste extraire le nom du champ s'il est entre guillemets
    else {
      const basicFieldMatch = regex.match(/"([^"]+)"/);
      if (basicFieldMatch && basicFieldMatch.length > 1) {
        fieldName = basicFieldMatch[1];
      }
    }
  }
  
  if (!fieldName) {
    console.warn(`[VAR-SUB] Impossible d'extraire le nom du champ à partir de la regex: ${regex}`);
    return false;
  }
  
  console.log(`[VAR-SUB] Recherche intelligente du champ "${fieldName}" dans l'objet JSON (valeur attendue: ${expectedValue || 'toute valeur'}, type: ${isNumericValue ? 'nombre' : 'chaîne'})`);
  
  // Convertir newValue en nombre si nécessaire
  let processedNewValue = newValue;
  if (isNumericValue && !isNaN(Number(newValue))) {
    processedNewValue = Number(newValue);
    console.log(`[VAR-SUB] Conversion de la valeur de remplacement en nombre: ${processedNewValue}`);
  }
  
  // Fonction récursive pour rechercher et remplacer le champ dans l'objet
  function searchAndReplace(currentObj, path = '') {
    if (!currentObj || typeof currentObj !== 'object') return false;
    
    let modified = false;
    
    // Traiter les tableaux
    if (Array.isArray(currentObj)) {
      for (let i = 0; i < currentObj.length; i++) {
        if (typeof currentObj[i] === 'object' && currentObj[i] !== null) {
          const childModified = searchAndReplace(currentObj[i], `${path}[${i}]`);
          modified = modified || childModified;
        }
      }
      return modified;
    }
    
    // Traiter les objets
    for (const [key, value] of Object.entries(currentObj)) {
      // Si la clé correspond au champ recherché
      if (key === fieldName) {
        // Vérifier si la valeur actuelle correspond à celle attendue
        let shouldReplace = false;
        
        if (expectedValue === null) {
          // Si aucune valeur attendue spécifique, remplacer quelle que soit la valeur actuelle
          shouldReplace = true;
        } 
        else if (typeof value === 'string' && !isNumericValue) {
          // Pour les chaînes, vérifier l'inclusion ou l'égalité exacte
          shouldReplace = value.includes(expectedValue) || value === expectedValue;
        } 
        else if (typeof value === 'number' && isNumericValue) {
          // Pour les nombres, vérifier l'égalité
          shouldReplace = value.toString() === expectedValue.toString();
        }
        
        if (shouldReplace) {
          const oldValue = currentObj[key];
          currentObj[key] = processedNewValue;
          console.log(`[VAR-SUB] Modification directe - ${path}.${key}: "${oldValue}" -> "${processedNewValue}"`);
          modified = true;
        }
      }
      // Recherche récursive dans les sous-objets
      else if (typeof value === 'object' && value !== null) {
        const childModified = searchAndReplace(value, path ? `${path}.${key}` : key);
        modified = modified || childModified;
      }
    }
    
    return modified;
  }
  
  return searchAndReplace(obj);
}
