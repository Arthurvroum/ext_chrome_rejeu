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
    
    // Vérifier s'il s'agit d'un fichier exporté qui contient des requêtes brutes
    if (openApiSpec.rawRequests && Array.isArray(openApiSpec.rawRequests)) {
      console.log('Utilisation des requêtes brutes préservées dans le fichier exporté:', openApiSpec.rawRequests.length);
      // Convertir directement les requêtes brutes en étapes
      return this.convertRecordedDataToScenario(openApiSpec.rawRequests);
    }
    
    // Validate that it's an OpenAPI spec
    if (!openApiSpec.openapi || !openApiSpec.paths) {
      console.error('Invalid OpenAPI format');
      return steps;
    }

    // Check if this is our own exported recording
    const isArkRecording = openApiSpec['x-ark-replayr'] && 
                          (openApiSpec['x-ark-replayr'].type === 'recording' || 
                           openApiSpec['x-ark-replayr'].type === 'raw-recording');
    
    console.log('Loading OpenAPI spec:', {
      isArkRecording,
      metadata: openApiSpec['x-ark-replayr'] || 'Not an Ark Replayr recording'
    });

    // Get server URLs from the spec (if available)
    const serverUrls = openApiSpec.servers && openApiSpec.servers.length > 0 
      ? openApiSpec.servers.map(server => server.url) 
      : [''];
    
    console.log('Extracting steps from OpenAPI spec with servers:', serverUrls);
    
    // Store operations to sort them by recorded index if available
    const operations = [];
    
    // Extract operations from paths
    for (const [path, pathItem] of Object.entries(openApiSpec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters' || method === 'summary' || method === 'description') continue;
        
        // Store path and method with the operation
        operations.push({
          path,
          method,
          operation,
          // Use recorded index if available, otherwise use a high number
          index: operation['x-recorded-index'] !== undefined ? 
                 operation['x-recorded-index'] : 9999
        });
      }
    }
    
    // Sort operations by their recorded index if this is our own recording
    if (isArkRecording) {
      operations.sort((a, b) => a.index - b.index);
    }
    
    // Process each operation
    for (const { path, method, operation } of operations) {
      // Get the original full URL from the x-original-url extension
      // or fall back to reconstructing from server + path
      const fullUrl = operation['x-original-url'] || 
        (openApiSpec['x-original-urls'] && openApiSpec['x-original-urls'][`${method.toLowerCase()}-${path}`]);
      
      if (fullUrl) {
        // Use the original full URL if available
        const step = createStepFromOperation(method, path, operation, fullUrl);
        steps.push(step);
      } else {
        // If no full URL, reconstruct from server + path + query params
        // Get the server URL (use the first one if multiple are available)
        const serverUrl = serverUrls[0] || '';
        
        // Construct URL with query parameters
        let reconstructedUrl = serverUrl + path;
        const queryParams = operation.parameters
          ?.filter(param => param.in === 'query')
          .map(param => `${param.name}=${encodeURIComponent(param.example || '')}`) || [];
        
        if (queryParams.length > 0) {
          reconstructedUrl += '?' + queryParams.join('&');
        }
        
        console.log(`Reconstructed URL for ${method} ${path}:`, reconstructedUrl);
        
        // Use the reconstructed URL
        const step = createStepFromOperation(method, path, operation, reconstructedUrl);
        steps.push(step);
      }
    }
    
    console.log('Extracted', steps.length, 'steps with full URLs');
    return steps;
    
    // Helper function to create a step from an operation
    function createStepFromOperation(method, path, operation, url) {
      // Extract request headers from header parameters
      const requestHeaders = {};
      const queryParameters = {};
      
      if (operation.parameters) {
        operation.parameters.forEach(param => {
          if (param.in === 'header') {
            requestHeaders[param.name] = param.example || '';
          } else if (param.in === 'query') {
            queryParameters[param.name] = param.example || '';
          }
        });
      }
      
      // Extract request body - amélioration pour mieux gérer les formats OpenAPI 3.0.0
      let requestBody = null;
      
      // Fonction utilitaire pour extraire le corps réel de toute structure complexe
      const extractRealBody = (body) => {
        if (body === null || body === undefined) {
          return null;
        }
        
        // Cas OpenAPI standard avec content.application/json.example
        if (body.content && body.content['application/json'] && body.content['application/json'].example) {
          console.log('Found body in content.application/json.example');
          return body.content['application/json'].example;
        }
        
        // Cas OpenAPI avec content.application/json.schema.example (comme dans votre exemple)
        if (body.content && body.content['application/json'] && 
            body.content['application/json'].schema && body.content['application/json'].schema.example) {
          console.log('Found body in content.application/json.schema.example');
          return body.content['application/json'].schema.example;
        }
        
        // Si c'est un autre type d'objet, le retourner tel quel
        return body;
      };
      
      // 1. Essayer d'utiliser directement le corps brut s'il existe
      if (operation['x-raw-body'] !== undefined) {
        requestBody = operation['x-raw-body'];
      }
      // 2. Sinon, essayer d'extraire du format OpenAPI standard
      else if (operation.requestBody) {
        // Extraire le corps réel quelle que soit sa structure
        requestBody = extractRealBody(operation.requestBody);
      }
      // 3. Dernier recours - vérifier si le corps est directement dans l'opération
      else if (operation.body) {
        requestBody = operation.body;
      }
      
      console.log(`Request body for ${method} ${path}:`, requestBody ? typeof requestBody : 'none');
      
      // Determine whether this came from a recording (for better CORS handling)
      const fromRecording = operation['x-recorded-metadata'] !== undefined || 
                           openApiSpec['x-ark-replayr']?.type === 'recording' ||
                           openApiSpec['x-ark-replayr']?.type === 'raw-recording';
      
      // Create the step with all necessary properties
      return {
        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        description: operation.description || `Recorded ${method.toUpperCase()} request to ${url}`,
        url: url,
        method: method.toUpperCase(),
        enabled: true,
        skip: false,
        parameters: operation.parameters || [],
        queryParameters: queryParameters,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        _originalRequestBody: operation.requestBody, // Garder le corps original pour débogage
        // Include response headers if available
        responseHeaders: operation['x-response-headers'] || {},
        // Include original status code if available
        statusCode: operation['x-recorded-metadata']?.statusCode,
        responses: operation.responses || {},
        variableSubstitutions: operation['x-variable-substitution'] || [],
        variableCaptures: operation['x-variable-capture'] || [],
        originalPath: path,
        // Mark as either imported or recorded based on metadata
        importedFromOpenAPI: true,
        fromRecording: fromRecording,
        // Include original metadata
        metadata: operation['x-recorded-metadata'] || null
      };
    }
  },
  
  /**
   * Convert recorded requests data to scenario steps
   * @param {Array} recordedRequests - Recorded request data
   * @returns {Array} - Array of step objects
   */
  async convertRecordedDataToScenario(recordedData) {
    if (!recordedData || !Array.isArray(recordedData)) {
      console.error('Invalid recorded data format:', recordedData);
      return [];
    }

    try {
      console.log('Converting recorded data to scenario, entries:', recordedData.length);
      // Filtrer les requêtes avec les méthodes que nous souhaitons inclure
      const filteredRequests = recordedData.filter(request => 
        request && request.method && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)
      );

      console.log('Filtered requests:', filteredRequests.length);

      // Convertir chaque requête enregistrée en étape de scénario
      return filteredRequests.map((request, index) => {
        // Fonction pour extraire le corps réel d'une structure OpenAPI ou autre format complexe
        const extractRequestBody = (body) => {
          // Si null ou undefined, retourner tel quel
          if (body === null || body === undefined) {
            return null;
          }
          
          // Si c'est une structure OpenAPI typique
          if (typeof body === 'object' && body.content && body.content['application/json']) {
            // Cas 1: Example direct
            if (body.content['application/json'].example) {
              console.log('Extracted body from content.application/json.example structure');
              return body.content['application/json'].example;
            }
            // Cas 2: Schema avec example
            else if (body.content['application/json'].schema && 
                    body.content['application/json'].schema.example) {
              console.log('Extracted body from content.application/json.schema.example structure');
              return body.content['application/json'].schema.example;
            }
          }
          
          // Cas spécifique: La requête est enveloppée dans un objet content (cas particulier pour Odoo)
          if (typeof body === 'object' && body.content) {
            console.log('Found potential Odoo content wrapper, attempting to extract');
            return body.content;
          }
          
          // Si c'est déjà un objet simple, le retourner tel quel
          return body;
        };

        // Extraire le corps réel de la requête
        let requestBody = extractRequestBody(request.body);
        
        // Extraire les paramètres de requête depuis l'URL si présents
        const urlObj = new URL(request.url, window.location.origin);
        const queryParams = {};
        urlObj.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });

        return {
          id: `step-${index + 1}`,
          name: `Étape ${index + 1}: ${request.method} ${urlObj.pathname}`,
          url: request.url,
          method: request.method,
          headers: request.headers || {},
          body: requestBody || null,
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : null,
          variables: [],
          enabled: true,
          delay: 0,
          originalRequest: request, // Garder la requête originale pour référence
          // Conserver le corps sous sa forme originale pour le débogage
          _originalBody: request.body
        };
      });
    } catch (error) {
      console.error('Error converting recorded data to scenario:', error);
      return [];
    }
  },
  
  /**
   * Start replay execution with improved error handling and retry mechanism
   * @param {Array} steps - Steps to replay
   * @param {Object} options - Execution options
   * @returns {Promise} - Promise that resolves with results
   */
  async startReplay(steps, options) {
    console.log('Starting replay with steps:', steps.length, 'and options:', options);
    
    // Update skip status based on enabled property
    const preparedSteps = steps.map(step => {
      // Ensure the step has all necessary properties for replay
      const preparedStep = {
        ...step,
        skip: !step.enabled,
        // Make sure URL is complete - apply baseUrl if specified in options
        url: this.applyBaseUrlIfNeeded(step.url, options.baseUrl),
        requestHeaders: step.requestHeaders || {},
        requestBody: step.requestBody || null,
        variableSubstitutions: step.variableSubstitutions || [],
        variableCaptures: step.variableCaptures || []
      };
      
      // Ajouter les variables globales aux captures de variables de chaque étape
      if (options.globalVariables && options.globalVariables.length > 0) {
        console.log(`Ajout de ${options.globalVariables.length} variables globales aux captures de l'étape`);
        
        // Si l'étape n'a pas de propriété variableCaptures, l'initialiser
        if (!preparedStep.variableCaptures) {
          preparedStep.variableCaptures = [];
        }
        
        // Ajouter les variables globales aux captures de l'étape
        // avec un flag spécial pour les identifier comme globales
        options.globalVariables.forEach(globalVar => {
          preparedStep.variableCaptures.push({
            ...globalVar,
            isGlobal: true, // Marquer comme variable globale
          });
        });
      }
      
      // Log the URL we're about to use
      console.log(`Prepared step: ${step.method} ${preparedStep.url}`);
      
      return preparedStep;
    });
    
    // Si l'intervalle entre les étapes est configuré, utiliser le mode pas à pas
    if (options.stepInterval > 0) {
      return this.startStepByStepReplay(preparedSteps, options);
    }
    
    // Prepare the scenario for replay (exécution standard)
    const replayConfig = {
      options,
      steps: preparedSteps
    };
    
    // Vérifier d'abord si le background script est actif
    try {
      await this.checkBackgroundScriptStatus();
    } catch (error) {
      console.error('Background script not active:', error);
      throw new Error(`L'extension semble ne pas être prête: ${error.message}. Rafraîchissez la page et réessayez.`);
    }
    
    // Send message to background script to execute replay with retry mechanism
    return this.sendMessageWithRetry(
      { action: 'replayRequests', scenario: replayConfig },
      3, // Nombre maximum de tentatives
      1000 // Délai entre les tentatives en ms
    );
  },
  
  /**
   * Execute replay step by step with an interval between steps (for CI/CD visualization)
   * @param {Array} steps - Steps to replay
   * @param {Object} options - Execution options including stepInterval
   * @returns {Promise} - Promise that resolves with results
   */
  async startStepByStepReplay(steps, options) {
    console.log('Starting step-by-step replay with interval:', options.stepInterval, 'ms');
    
    // Vérifier d'abord si le background script est actif
    try {
      await this.checkBackgroundScriptStatus();
    } catch (error) {
      console.error('Background script not active:', error);
      throw new Error(`L'extension semble ne pas être prête: ${error.message}. Rafraîchissez la page et réessayez.`);
    }
    
    const results = [];
    let currentStepIndex = 0;
    // Stockage central pour les variables globales capturées
    const globalVariablesResults = {};
    
    // Créer une promesse qui sera résolue une fois que toutes les étapes auront été exécutées
    return new Promise((resolve, reject) => {
      // Fonction pour exécuter une étape
      const executeStep = async (stepIndex) => {
        if (stepIndex >= steps.length) {
          // Toutes les étapes ont été exécutées
          console.log('Step-by-step replay completed with', results.length, 'results');
          
          // Ajouter les variables globales capturées aux résultats
          if (Object.keys(globalVariablesResults).length > 0) {
            console.log('Variables globales capturées:', globalVariablesResults);
            // Ajouter les variables globales dans les résultats pour l'affichage dans l'onglet Variables
            results.globalVariables = globalVariablesResults;
          }
          
          // Notifier que l'exécution est terminée
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('step-execution-progress', { 
              detail: { 
                currentStepIndex: -1,
                results: [...results],
                status: 'completed'
              }
            }));
          }
          
          resolve(results);
          return;
        }
        
        const step = steps[stepIndex];
        console.log(`Executing step ${stepIndex + 1}/${steps.length}: ${step.method} ${step.url}`);
        
        // Notifier du début d'exécution de cette étape (pour l'animation)
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('step-execution-progress', { 
            detail: { 
              currentStepIndex: stepIndex,
              results: [...results],
              status: 'in-progress'
            }
          }));
        }
        
        try {
          // Préparer un scénario avec une seule étape
          const singleStepConfig = {
            options: { ...options, showRuntimeProgress: false }, // Désactiver l'option pour cette exécution unique
            steps: [step]
          };
          
          // Envoyer la demande d'exécution au background script
          const stepResult = await this.sendMessageWithRetry(
            { action: 'replayRequests', scenario: singleStepConfig },
            3, // Nombre maximum de tentatives
            1000 // Délai entre les tentatives en ms
          );
          
          // Ajouter le résultat au tableau
          if (stepResult && stepResult.length > 0) {
            results.push(stepResult[0]);
          }
          
          // Notifier de la fin d'exécution de cette étape (résultat disponible)
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('step-execution-progress', { 
              detail: { 
                currentStepIndex: stepIndex,
                results: [...results],
                status: stepResult[0]?.status || 'completed'
              }
            }));
          }
          
          // Si l'option d'arrêt sur erreur est activée et que l'étape a échoué
          if (options.stopOnError && stepResult && stepResult[0] && stepResult[0].status === 'error') {
            console.log('Stopping execution due to error in step', stepIndex + 1);
            
            // Notifier de l'arrêt (pour l'UI)
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('step-execution-progress', { 
                detail: { 
                  currentStepIndex: -1,
                  results: [...results],
                  status: 'stopped'
                }
              }));
            }
            
            resolve(results);
            return;
          }
          
          // Attendre l'intervalle configuré avant d'exécuter l'étape suivante
          console.log(`Waiting ${options.stepInterval}ms before next step...`);
          setTimeout(() => {
            executeStep(stepIndex + 1);
          }, options.stepInterval);
          
        } catch (error) {
          console.error(`Error executing step ${stepIndex + 1}:`, error);
          
          // Ajouter une entrée d'erreur au résultat
          results.push({
            url: step.url,
            method: step.method,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          // Notifier de l'erreur (pour l'UI)
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('step-execution-progress', { 
              detail: { 
                currentStepIndex: stepIndex,
                results: [...results],
                status: 'error'
              }
            }));
          }
          
          // Si l'option d'arrêt sur erreur est activée, arrêter l'exécution
          if (options.stopOnError) {
            resolve(results);
            return;
          }
          
          // Sinon, continuer avec l'étape suivante après l'intervalle
          console.log(`Waiting ${options.stepInterval}ms before next step...`);
          setTimeout(() => {
            executeStep(stepIndex + 1);
          }, options.stepInterval);
        }
      };
      
      // Commencer l'exécution avec la première étape
      executeStep(0);
    });
  },
  
  /**
   * Send a message to the background script with retry mechanism
   * @param {Object} message - Message to send
   * @param {Number} maxRetries - Maximum number of retries
   * @param {Number} delay - Delay between retries in ms
   * @returns {Promise} - Promise that resolves with response
   */
  sendMessageWithRetry(message, maxRetries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const tryToSendMessage = () => {
        attempts++;
        console.log(`Sending message attempt ${attempts}/${maxRetries + 1}:`, message.action);
        
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`Error in attempt ${attempts}:`, chrome.runtime.lastError);
            
            // Si nous avons encore des tentatives disponibles, réessayer
            if (attempts <= maxRetries) {
              console.log(`Retrying in ${delay}ms...`);
              setTimeout(tryToSendMessage, delay);
            } else {
              reject(new Error(`Could not communicate with background script after ${maxRetries + 1} attempts: ${chrome.runtime.lastError.message}`));
            }
          } else if (response && response.status === 'Replay completed') {
            console.log('Replay completed successfully:', response.results?.length || 0, 'results');
            resolve(response.results);
          } else if (response && response.error) {
            console.error('Error during replay:', response.error);
            reject(new Error(response.error));
          } else if (response) {
            console.log('Unexpected response format:', response);
            resolve(response); // Résoudre avec la réponse même si elle n'est pas dans le format attendu
          } else {
            reject(new Error('No response received from background script'));
          }
        });
      };
      
      // Commencer le processus d'envoi
      tryToSendMessage();
    });
  },
  
  /**
   * Check if the background script is active
   * @returns {Promise} - Promise that resolves if the background script is active
   */
  checkBackgroundScriptStatus() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'checkExtensionStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Background script not responding: ${chrome.runtime.lastError.message}`));
        } else if (response && response.status) {
          console.log('Background script status:', response.status);
          resolve(response);
        } else {
          reject(new Error('Background script responded but no status received'));
        }
      });
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
  },

  /**
   * Apply baseUrl to a URL if needed
   * @param {String} originalUrl - Original URL
   * @param {String} baseUrl - Base URL to apply (optional)
   * @returns {String} - Modified URL with new base if baseUrl is provided
   */
  applyBaseUrlIfNeeded(originalUrl, baseUrl) {
    // Si pas de baseUrl ou URL originale vide, retourner l'URL d'origine
    if (!baseUrl || !originalUrl) {
      return originalUrl;
    }
    
    try {
      // Analyser l'URL originale
      const urlObj = new URL(originalUrl);
      
      // Analyser la baseUrl
      let baseUrlObj;
      try {
        // S'assurer que la baseUrl a un protocole
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrlObj = new URL('http://' + baseUrl);
        } else {
          baseUrlObj = new URL(baseUrl);
        }
      } catch (e) {
        console.warn('Invalid baseUrl format:', baseUrl, e);
        return originalUrl;
      }
      
      // Construire la nouvelle URL en conservant le chemin et les paramètres
      // mais en remplaçant le protocole, l'hôte et le port
      const newUrl = new URL(urlObj.pathname + urlObj.search + urlObj.hash, baseUrlObj.origin);
      
      console.log(`Applied baseUrl: ${originalUrl} → ${newUrl.href}`);
      return newUrl.href;
    } catch (e) {
      console.warn('Error applying baseUrl:', e);
      return originalUrl;
    }
  },

  /**
   * Extraire la base URL commune à partir d'un ensemble d'étapes
   * @param {Array} steps - Étapes contenant des URLs
   * @returns {String} - Base URL commune ou chaîne vide si aucune base commune
   */
  extractCommonBaseUrl(steps) {
    if (!steps || steps.length === 0) {
      console.warn('Aucune étape fournie pour l\'extraction de la base URL');
      return '';
    }
    
    try {
      console.log('Extraction de la base URL commune à partir de', steps.length, 'étapes');
      
      // Vérifier si les étapes ont des URLs valides
      const stepsWithUrls = steps.filter(step => step && step.url && typeof step.url === 'string');
      
      if (stepsWithUrls.length === 0) {
        console.warn('Aucune étape avec URL valide trouvée');
        return '';
      }
      
      console.log('Nombre d\'étapes avec URLs valides:', stepsWithUrls.length);
      
      // Collecter toutes les origines (protocol + hostname + port)
      const origins = stepsWithUrls
        .map(step => {
          try {
            // Vérifier si l'URL a un protocole, sinon ajouter http:// temporairement
            let url = step.url;
            if (!url.match(/^https?:\/\//i)) {
              url = 'http://' + url;
            }
            
            const urlObj = new URL(url);
            return urlObj.origin;
          } catch (e) {
            console.warn('Erreur lors de l\'analyse de l\'URL:', step.url, e);
            return null;
          }
        })
        .filter(origin => origin !== null);
      
      console.log('Origines extraites:', origins);
      
      // Si aucune origine valide trouvée
      if (origins.length === 0) {
        console.warn('Aucune origine valide extraite des URLs');
        return '';
      }
      
      // Trouver l'origine la plus fréquente
      const originCounts = {};
      let maxCount = 0;
      let mostCommonOrigin = '';
      
      origins.forEach(origin => {
        originCounts[origin] = (originCounts[origin] || 0) + 1;
        if (originCounts[origin] > maxCount) {
          maxCount = originCounts[origin];
          mostCommonOrigin = origin;
        }
      });
      
      // Si l'origine la plus fréquente est présente dans moins de 50% des URLs, c'est peut-être pas une vraie base commune
      const percentage = (maxCount / origins.length) * 100;
      if (percentage < 50) {
        console.warn(`L'origine la plus fréquente (${mostCommonOrigin}) n'est présente que dans ${percentage.toFixed(1)}% des URLs.`);
      }
      
      console.log(`Base URL commune extraite: ${mostCommonOrigin} (présente dans ${maxCount}/${origins.length} URLs, ${percentage.toFixed(1)}%)`);
      return mostCommonOrigin;
    } catch (e) {
      console.error('Erreur lors de l\'extraction de la base URL commune:', e);
      return '';
    }
  },
};

export default replayService;
