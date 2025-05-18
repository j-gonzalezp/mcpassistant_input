// C:\Users\joaqu\mcpfiles\MCP-SuperAssistant-main\pages\content\src\index.ts
/**
 * Content Script
 */

import './tailwind-input.css';
import { logMessage } from '@src/utils/helpers';
import { mcpHandler } from '@src/utils/mcpHandler';
import {
  initialize as initializeRenderer,
  startDirectMonitoring,
  stopDirectMonitoring,
  processFunctionCalls as renderFunctionCalls,
  checkForUnprocessedFunctionCalls,
  configureFunctionCallRenderer,
} from '@src/render_prescript/src/index';
import { adapterRegistry, getCurrentAdapter } from '@src/adapters/adapterRegistry';
import './adapters'; // Importa y registra los adaptadores

// --- NUEVO: Importar utilidades de storage ---
import { getSidebarPreferences, saveSidebarPreferences } from '@src/utils/storage';
// --- FIN NUEVO ---

// --- INICIO: LÓGICA DE AUTO-SCROLL ---
const AUTO_SCROLL_INTERVAL_MS = 15000; // Intervalo de 15 segundos
let isAutoScrollActive = false; // Estado global para el auto-scroll
let autoScrollIntervalId: number | null = null;

/**
 * Realiza el scroll en el elemento designado por el adaptador actual si el auto-scroll está activo.
 */
function performPeriodicScroll(): void {
  if (!isAutoScrollActive) return; // Solo actuar si está activo

  const adapter = getCurrentAdapter();
  // Solo proceder si el adaptador es AiStudio y tiene el método getScrollableElement
  if (adapter && adapter.name === 'AiStudio' && typeof adapter.getScrollableElement === 'function') {
    const scrollableDiv = adapter.getScrollableElement();
    if (scrollableDiv) {
      const isNearBottom = (scrollableDiv.scrollHeight - scrollableDiv.scrollTop - scrollableDiv.clientHeight) < 10;
      if (!isNearBottom) {
        const scrollAmount = Math.min(
          scrollableDiv.clientHeight * 0.8, 
          scrollableDiv.scrollHeight - scrollableDiv.scrollTop - scrollableDiv.clientHeight
        );
        if (scrollAmount > 0) {
          scrollableDiv.scrollTop += scrollAmount;
          logMessage(`[AutoScroll] Scrolled content on ${adapter.name}`);
        }
      }
    }
  }
}

/**
 * Inicia el intervalo de auto-scroll si está activo y no ya corriendo.
 */
function startAutoScroll(): void {
  if (isAutoScrollActive && autoScrollIntervalId === null) {
    const adapter = getCurrentAdapter();
    if (adapter && adapter.name === 'AiStudio') { // Asegurarse de que solo se active para AI Studio
        logMessage('[AutoScroll] Starting periodic scroll for AiStudio adapter.');
        autoScrollIntervalId = window.setInterval(performPeriodicScroll, AUTO_SCROLL_INTERVAL_MS);
    }
  }
}

/**
 * Detiene el intervalo de auto-scroll si está activo.
 */
function stopAutoScroll(): void {
  if (autoScrollIntervalId !== null) {
    logMessage('[AutoScroll] Stopping periodic scroll.');
    window.clearInterval(autoScrollIntervalId);
    autoScrollIntervalId = null;
  }
}

/**
 * Actualiza el estado del auto-scroll y lo persiste en el storage.
 * Esta función será llamada por el Sidebar.
 */
async function setAutoScrollStateAndPersist(isActive: boolean): Promise<void> {
  isAutoScrollActive = isActive;
  logMessage(`[AutoScroll] State changed to: ${isActive}`);
  
  if (isActive) {
    startAutoScroll();
  } else {
    stopAutoScroll();
  }
  
  try {
    await saveSidebarPreferences({ isAutoScrollActive: isActive });
    logMessage(`[AutoScroll] Preference saved to storage: isAutoScrollActive = ${isActive}`);
  } catch (error) {
    logMessage(`[AutoScroll] Error saving auto-scroll preference: ${error}`);
  }
}

/**
 * Obtiene el estado actual del auto-scroll.
 * Esta función será llamada por el Sidebar para inicializar su toggle.
 */
function getAutoScrollState(): boolean {
  return isAutoScrollActive;
}

// Exponer la API para el Sidebar
if (typeof window !== 'undefined') {
  (window as any).mcpContentScriptApi = {
    ...(window as any).mcpContentScriptApi, // Preservar otras APIs si existen
    setAutoScrollState: setAutoScrollStateAndPersist,
    getAutoScrollState: getAutoScrollState,
  };
  logMessage('[ContentScript] Auto-scroll API exposed to window.mcpContentScriptApi');
}

/**
 * Carga las preferencias iniciales para el auto-scroll y lo inicia si es aplicable.
 */
async function initializeAutoScroll(): Promise<void> {
  try {
    const preferences = await getSidebarPreferences();
    isAutoScrollActive = preferences.isAutoScrollActive ?? false; // Usar default si no existe
    logMessage(`[AutoScroll] Initialized. Active state from storage: ${isAutoScrollActive}`);
    // Intentar iniciar el scroll basado en el estado cargado y el adaptador actual
    const adapter = getCurrentAdapter();
    if (adapter && adapter.name === 'AiStudio' && isAutoScrollActive) {
        startAutoScroll();
    } else if (isAutoScrollActive && (!adapter || adapter.name !== 'AiStudio')) {
        // Si estaba activo pero no estamos en AI Studio, lo desactivamos lógicamente
        isAutoScrollActive = false; 
        logMessage('[AutoScroll] Was active in storage, but not on AI Studio. Setting to inactive.');
    }

  } catch (error) {
    logMessage(`[AutoScroll] Error initializing auto-scroll state from storage: ${error}`);
    isAutoScrollActive = false; // Default a false en caso de error
  }
}
// --- FIN: LÓGICA DE AUTO-SCROLL ---

function setupSidebarRecovery(): void {
  // ... (código de setupSidebarRecovery sin cambios)
  const recoveryInterval = setInterval(() => {
    try {
      const sidebarManager = (window as any).activeSidebarManager;
      if (!sidebarManager) return;
      const htmlElement = document.documentElement;
      if (htmlElement.classList.contains('push-mode-enabled')) {
        const shadowHost = sidebarManager.getShadowHost();
        if (shadowHost) {
          if (
            shadowHost.style.display !== 'block' ||
            window.getComputedStyle(shadowHost).display === 'none' ||
            shadowHost.style.opacity !== '1' ||
            parseFloat(window.getComputedStyle(shadowHost).opacity) < 0.9
          ) {
            logMessage('[SidebarRecovery] Detected invisible sidebar, forcing visibility');
            shadowHost.style.display = 'block';
            shadowHost.style.opacity = '1';
            shadowHost.classList.add('initialized');
            sidebarManager.refreshContent();
          }
        } else {
          logMessage('[SidebarRecovery] Push mode enabled but shadow host missing, re-initializing');
          sidebarManager.initialize().then(() => {
            sidebarManager.show();
          });
        }
      }
    } catch (error) {
      console.error('[SidebarRecovery] Error:', error);
    }
  }, 1000);
  window.addEventListener('unload', () => {
    clearInterval(recoveryInterval);
  });
  logMessage('[SidebarRecovery] Sidebar recovery mechanism set up');
}

const initializedAdapters = new Set<string>();
logMessage('Content script loaded');

try {
  chrome.runtime.sendMessage({
    command: 'trackAnalyticsEvent',
    eventName: 'content_script_loaded',
    eventParams: { hostname: window.location.hostname, path: window.location.pathname },
  });
} catch (error) {
  console.error('[ContentScript] Error sending analytics:', error instanceof Error ? error.message : String(error));
}

setupSidebarRecovery();

(function instantInitialize() {
  try {
    initializeRenderer();
    logMessage('Function call renderer initialized immediately');
  } catch (error) {
    console.error('Error in immediate renderer initialization:', error);
  }
})();

// --- MODIFICADO: Llamar a initializeAutoScroll ---
(async function initializeCurrentAdapterAndAutoScroll() { // Convertido a async
  try {
    // Primero inicializar el estado del auto-scroll desde el storage
    await initializeAutoScroll(); 

    const currentHostname = window.location.hostname;
    const adapter = adapterRegistry.getAdapter(currentHostname);

    if (adapter) {
      const adapterId = adapter.name;
      if (!initializedAdapters.has(adapterId)) {
        logMessage(`Initializing site adapter for ${adapter.name}`);
        adapter.initialize();
        initializedAdapters.add(adapterId);
        (window as any).mcpAdapter = adapter;
        logMessage(`Exposed adapter ${adapter.name} to global window.mcpAdapter`);
      } else {
        logMessage(`Adapter ${adapter.name} already initialized, skipping re-initialization`);
        (window as any).mcpAdapter = adapter;
      }
      // El estado de auto-scroll ya se cargó, startAutoScroll se llamó si era aplicable
      // Si el adaptador cambia (navegación SPA), necesitamos re-evaluar
      if (isAutoScrollActive && adapter.name === 'AiStudio') {
          startAutoScroll(); // Asegurar que se inicie si el adaptador es el correcto y está activo
      } else {
          stopAutoScroll(); // Detener si no es el adaptador correcto
      }
    } else {
      logMessage('No adapter found for current hostname, cannot initialize');
      stopAutoScroll(); 
    }
  } catch (error) {
    console.error('Error initializing current adapter and/or auto-scroll:', error);
    stopAutoScroll();
  }
})();

mcpHandler.onConnectionStatusChanged(isConnected => {
  logMessage(`MCP connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);
  const currentHostname = window.location.hostname;
  const adapter = adapterRegistry.getAdapter(currentHostname);
  if (adapter) {
    adapter.updateConnectionStatus(isConnected);
    (window as any).mcpAdapter = adapter;
  }
});

let rendererInitialized = false;
const initRendererWithRetry = (retries = 3, delay = 300) => {
  // ... (código de initRendererWithRetry sin cambios)
  if (rendererInitialized) return;
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    try {
      initializeRenderer(); 
      rendererInitialized = true;
      logMessage('Function call renderer initialized successfully on retry.');
      setTimeout(() => {
        if (rendererInitialized) {
          renderFunctionCalls();
          checkForUnprocessedFunctionCalls();
        }
      }, 500);
    } catch (error) {
      console.error('Error initializing function call renderer:', error);
      if (retries > 0) {
        setTimeout(() => initRendererWithRetry(retries - 1, delay), delay);
      }
    }
  } else {
    setTimeout(() => initRendererWithRetry(retries, delay), 100);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!rendererInitialized) initRendererWithRetry();
  });
} else {
  if (!rendererInitialized) initRendererWithRetry();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... (código de onMessage sin cambios)
  logMessage(`Message received in content script: ${JSON.stringify(message.command || message.type)}`);
  const currentHostname = window.location.hostname;
  const adapter = adapterRegistry.getAdapter(currentHostname);

  if (message.command === 'getStats') {
    sendResponse({
      success: true,
      stats: {
        mcpConnected: mcpHandler.getConnectionStatus(),
        activeSite: adapter?.name || 'Unknown',
      },
    });
  } else if (message.command === 'toggleSidebar') {
    if (adapter) {
      adapter.toggleSidebar();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No active site adapter' });
    }
  } else if (message.command === 'showSidebarWithToolOutputs') {
    if (adapter) {
      adapter.showSidebarWithToolOutputs();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No active site adapter' });
    }
  } else if (message.command === 'callMcpTool') {
    const { toolName, args } = message;
    if (toolName && args) {
      mcpHandler.callTool(toolName, args, (result, error) => {
        if (error) {
          sendResponse({ success: false, error });
        } else {
          sendResponse({ success: true, result });
        }
      });
      return true; 
    } else {
      sendResponse({ success: false, error: 'Invalid tool call request' });
    }
  } else if (message.command === 'refreshSidebarContent') {
    if (adapter) {
      adapter.refreshSidebarContent();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No active site adapter' });
    }
  } else if (message.command === 'setFunctionCallRendering') {
    const { enabled } = message;
    if (rendererInitialized) {
      if (enabled) {
        startDirectMonitoring();
        renderFunctionCalls();
        checkForUnprocessedFunctionCalls();
      } else {
        stopDirectMonitoring();
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Renderer not initialized' });
    }
  } else if (message.command === 'forceRenderFunctionCalls') {
    if (rendererInitialized) {
      renderFunctionCalls();
      checkForUnprocessedFunctionCalls();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Renderer not initialized' });
    }
  } else if (message.command === 'configureRenderer') {
    if (rendererInitialized) {
      configureFunctionCallRenderer(message.options);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Renderer not initialized' });
    }
  }
  return true;
});

window.addEventListener('beforeunload', () => {
  logMessage('[ContentScript] beforeunload event triggered.');
  stopAutoScroll(); // --- NUEVO: Detener el auto-scroll ---

  const currentHostname = window.location.hostname;
  const adapter = adapterRegistry.getAdapter(currentHostname);
  if (adapter) {
    adapter.cleanup();
  }
  initializedAdapters.clear();
});

(window as any).mcpHandler = mcpHandler;
console.debug('[Content Script] mcpHandler exposed to window object.');

// --- MODIFICADO: La inicialización del adaptador y auto-scroll ya se hizo arriba en initializeCurrentAdapterAndAutoScroll ---
// const currentAdapterOnLoad = getCurrentAdapter();
// if (currentAdapterOnLoad) {
//   (window as any).mcpAdapter = currentAdapterOnLoad;
//   console.debug(`[Content Script] Current adapter (${currentAdapterOnLoad.name}) exposed.`);
// }