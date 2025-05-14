/**
 * AiStudio Adapter
 *
 * This file implements the site adapter for aistudio.google.com
 */

import { BaseAdapter } from './common';
import { logMessage } from '../utils/helpers';
import { 
  insertToolResultToChatInput, 
  attachFileToChatInput, 
  submitChatInput 
} from '../components/websites/aistudio/chatInputHandler';
import { SidebarManager } from '../components/sidebar';
// +++ MODIFICACIÓN: Asegurarse de que la importación esté ACTIVA +++
import { initAIStudioComponents } from './adaptercomponents'; 

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
    
    // +++ MODIFICACIÓN: Llamar a initAIStudioComponents (ahora que está importada) +++
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
      logMessage('[AiStudioAdapter] initializeObserver: initAIStudioComponents is not defined or not a function. Button MCP might not appear.');
      console.warn('[AiStudioAdapter] initAIStudioComponents is not available. Site-specific components beyond the sidebar might not load.');
    }

    // La lógica de URL checking puede reactivarse si es necesaria y no causa problemas.
    // if (!this.urlCheckInterval) {
    //   this.lastUrl = window.location.href;
    //   this.urlCheckInterval = window.setInterval(() => {
    //     const currentUrl = window.location.href;
    //     if (currentUrl !== this.lastUrl) {
    //       logMessage(`[AiStudioAdapter] URL changed from ${this.lastUrl} to ${currentUrl}`);
    //       this.lastUrl = currentUrl;
    //       if (typeof initAIStudioComponents === 'function') {
    //          try { initAIStudioComponents(); } catch (e) { console.error(e); }
    //       }
    //       this.checkCurrentUrl();
    //     }
    //   }, 1000);
    //   logMessage('[AiStudioAdapter] initializeObserver: URL check interval STARTED.');
    // }
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

  async insertTextIntoInput(text: string): Promise<boolean> {
    logMessage('[AiStudioAdapter] insertTextIntoInput: START');
    try {
      const success = await insertToolResultToChatInput(text);
      logMessage(`[AiStudioAdapter] insertTextIntoInput: Attempted. Success: ${success}.`);
      return success;
    } catch (error) {
      console.error('[AiStudioAdapter] Error calling insertToolResultToChatInput:', error);
      logMessage(`[AiStudioAdapter] insertTextIntoInput: Error - ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      logMessage('[AiStudioAdapter] insertTextIntoInput: END');
    }
  }

  async triggerSubmission(): Promise<boolean> {
    logMessage('[AiStudioAdapter] triggerSubmission: START');
    try {
      const success = await submitChatInput(); 
      logMessage(`[AiStudioAdapter] triggerSubmission: Attempted. Success: ${success}`);
      return success;
    } catch (error) {
      logMessage(`[AiStudioAdapter] triggerSubmission: Error - ${error instanceof Error ? error.message : String(error)}`);
      console.error('[AiStudioAdapter] Error triggering submission:', error);
      return false;
    } finally {
      logMessage('[AiStudioAdapter] triggerSubmission: END');
    }
  }

  supportsFileUpload(): boolean {
    logMessage('[AiStudioAdapter] supportsFileUpload called');
    return true; 
  }

  async attachFile(file: File): Promise<boolean> {
    logMessage('[AiStudioAdapter] attachFile: START');
    try {
      const result = await attachFileToChatInput(file);
      logMessage(`[AiStudioAdapter] attachFile: Attempted. Result: ${result}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`[AiStudioAdapter] attachFile: Error - ${errorMessage}`);
      console.error('[AiStudioAdapter] Error attaching file:', error);
      return false;
    } finally {
      logMessage('[AiStudioAdapter] attachFile: END');
    }
  }

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
}