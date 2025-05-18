// C:\Users\joaqu\mcpfiles\MCP-SuperAssistant-main\pages\content\src\adapters\aistudioAdapter.ts
/**
 * AiStudio Adapter
 */

import { BaseAdapter } from './common'; 
import { logMessage } from '../utils/helpers';
// --- IMPORTACIONES CORREGIDAS Y COMPLETAS ---
import { 
  insertToolResultToChatInput, 
  attachFileToChatInput, 
  submitChatInput 
} from '../components/websites/aistudio/chatInputHandler';
// --- FIN IMPORTACIONES ---

import { SidebarManager } from '../components/sidebar';
import { initAIStudioComponents } from './adaptercomponents/aistudio'; 

export class AiStudioAdapter extends BaseAdapter {
  name = 'AiStudio';
  hostname = ['aistudio.google.com'];

  private lastUrl: string = '';
  private urlCheckInterval: number | null = null;

  constructor() {
    super();
    logMessage('[AiStudioAdapter] Constructor: START');
    this.sidebarManager = SidebarManager.getInstance('aistudio');
    logMessage('[AiStudioAdapter] Constructor: SidebarManager instance created.');
    logMessage('[AiStudioAdapter] Constructor: END');
  }

  protected initializeSidebarManager(): void {
    logMessage('[AiStudioAdapter] initializeSidebarManager: START');
    if (this.sidebarManager) {
      this.sidebarManager.initialize();
      logMessage('[AiStudioAdapter] initializeSidebarManager: Called this.sidebarManager.initialize()');
    } else {
      logMessage('[AiStudioAdapter] initializeSidebarManager: ERROR - sidebarManager is null.');
    }
    logMessage('[AiStudioAdapter] initializeSidebarManager: END');
  }

  protected initializeObserver(forceReset: boolean = false): void {
    logMessage('[AiStudioAdapter] initializeObserver: START');
    this.checkCurrentUrl(); 
    if (typeof initAIStudioComponents === 'function') {
      logMessage('[AiStudioAdapter] initializeObserver: Attempting to call initAIStudioComponents()...');
      try {
        initAIStudioComponents(); 
        logMessage('[AiStudioAdapter] initializeObserver: Called initAIStudioComponents() successfully.');
      } catch (error) {
        logMessage(`[AiStudioAdapter] initializeObserver: ERROR calling initAIStudioComponents() - ${error}`);
        console.error('[AiStudioAdapter] Error during initAIStudioComponents execution:', error);
      }
    } else {
      logMessage('[AiStudioAdapter] initializeObserver: initAIStudioComponents is not defined or not a function.');
      console.warn('[AiStudioAdapter] initAIStudioComponents is not available.');
    }
    logMessage('[AiStudioAdapter] initializeObserver: END');
  }

  cleanup(): void {
    logMessage('[AiStudioAdapter] cleanup: START');
    if (this.urlCheckInterval) {
      window.clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
      logMessage('[AiStudioAdapter] cleanup: URL check interval CLEARED.');
    }
    super.cleanup();
    logMessage('[AiStudioAdapter] cleanup: END');
  }

  insertTextIntoInput(text: string): void {
    logMessage('[AiStudioAdapter] insertTextIntoInput: START');
    // insertToolResultToChatInput ya es async y devuelve Promise<boolean>
    // BaseAdapter espera void, así que no podemos hacerla async aquí directamente.
    // La función insertToolResultToChatInput ya tiene logging.
    insertToolResultToChatInput(text)
      .then(success => {
        logMessage(`[AiStudioAdapter] insertTextIntoInput: insertToolResultToChatInput reported: ${success}`);
      })
      .catch(error => {
        logMessage(`[AiStudioAdapter] insertTextIntoInput: Error from insertToolResultToChatInput - ${error}`);
      })
      .finally(() => {
        logMessage('[AiStudioAdapter] insertTextIntoInput: END');
      });
  }

  // --- triggerSubmission ACTUALIZADO ---
  triggerSubmission(): void {
    logMessage('[AiStudioAdapter] triggerSubmission: START. Attempting to call submitChatInput...');
    // submitChatInput es async y devuelve Promise<boolean>
    // BaseAdapter espera void.
    submitChatInput()
      .then((success: boolean) => {
        logMessage(`[AiStudioAdapter] triggerSubmission: submitChatInput call completed. Success: ${success}`);
      })
      .catch((error: Error) => {
        logMessage(`[AiStudioAdapter] triggerSubmission: Error calling submitChatInput - ${error.message}`);
        console.error('[AiStudioAdapter] Error in triggerSubmission calling submitChatInput:', error);
      })
      .finally(() => {
        logMessage('[AiStudioAdapter] triggerSubmission: END');
      });
  }
  // --- FIN triggerSubmission ACTUALIZADO ---

  supportsFileUpload(): boolean {
    logMessage('[AiStudioAdapter] supportsFileUpload called, returning true.');
    return true; 
  }

  // --- attachFile ACTUALIZADO ---
  async attachFile(file: File): Promise<boolean> {
    logMessage(`[AiStudioAdapter] attachFile: START for file ${file.name}`);
    try {
      const result = await attachFileToChatInput(file); // Llamada a la función importada
      logMessage(`[AiStudioAdapter] attachFile: attachFileToChatInput call completed. Result: ${result}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`[AiStudioAdapter] attachFile: Error - ${errorMessage}`);
      console.error('[AiStudioAdapter] Error attaching file:', error);
      return false;
    } finally {
      logMessage(`[AiStudioAdapter] attachFile: END for file ${file.name}`);
    }
  }
  // --- FIN attachFile ACTUALIZADO ---

  private checkCurrentUrl(): void {
    logMessage('[AiStudioAdapter] checkCurrentUrl: START');
    const currentUrl = window.location.href;
    logMessage(`[AiStudioAdapter] checkCurrentUrl: Current URL is ${currentUrl}`);

    if (this.sidebarManager) {
      if (!this.sidebarManager.getIsVisible || typeof this.sidebarManager.getIsVisible !== 'function' || !this.sidebarManager.getIsVisible()) {
        logMessage('[AiStudioAdapter] checkCurrentUrl: Sidebar not visible or getIsVisible not a function. Attempting to show sidebar...');
        if (typeof this.sidebarManager.showWithToolOutputs === 'function') {
          this.sidebarManager.showWithToolOutputs();
          logMessage('[AiStudioAdapter] checkCurrentUrl: Called showWithToolOutputs.');
        } else {
          logMessage('[AiStudioAdapter] checkCurrentUrl: ERROR - showWithToolOutputs method not found on sidebarManager.');
          console.error('[AiStudioAdapter] showWithToolOutputs method not found on sidebarManager:', this.sidebarManager);
        }
      } else {
        logMessage('[AiStudioAdapter] checkCurrentUrl: Sidebar manager reports sidebar is already visible or getIsVisible not available.');
      }
    } else {
      logMessage('[AiStudioAdapter] checkCurrentUrl: ERROR - sidebarManager is null.');
      console.error('[AiStudioAdapter] sidebarManager is null in checkCurrentUrl');
    }
    logMessage('[AiStudioAdapter] checkCurrentUrl: END');
  }

  public override getScrollableElement(): HTMLElement | null {
    const selector = 'ms-autoscroll-container';
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) {
      logMessage(`[${this.name}Adapter] Scrollable element not found with selector: "${selector}"`);
    } else {
      logMessage(`[${this.name}Adapter] Found scrollable element with selector: "${selector}"`);
    }
    return element;
  }
}