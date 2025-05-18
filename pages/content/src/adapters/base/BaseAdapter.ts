// pages/content/src/adapters/base/BaseAdapter.ts

import type { BaseSidebarManager } from '../../components/sidebar/base/BaseSidebarManager'; // Corrected import
import type { McpRequestStatusManager } from '../../index'; // Corrected to import exported type
import type { McpHandler, CallToolMessage } from '../../types/messaging'; // Corrected import for McpHandler and using CallToolMessage

// SiteAdapter interface defines the contract for all site-specific adapters
export interface SiteAdapter {
  // Properties
  mcpHandler: McpHandler;
  sidebarManager?: BaseSidebarManager; // Changed to BaseSidebarManager
  requestStatusState: McpRequestStatusManager;

  // Core methods
  initializeObserver(): void;
  checkCurrentUrl?(): void;
  cleanup?(): void;

  // UI Interaction methods
  insertTextIntoInput?(text: string): Promise<void>;
  triggerSubmission?(): Promise<void>;
  getChatInputElement?(): HTMLTextAreaElement | HTMLInputElement | null;
  showErrorFeedback?(message: string): void;

  // Site-specific initializers (example)
  initAIStudioComponents?(): void;
}

export abstract class BaseAdapter implements SiteAdapter {
  public mcpHandler: McpHandler;
  public sidebarManager?: BaseSidebarManager; // Changed to BaseSidebarManager
  public requestStatusState: McpRequestStatusManager;

  constructor(requestStatusState: McpRequestStatusManager, mcpHandler?: McpHandler) {
    this.requestStatusState = requestStatusState;
    
    this.mcpHandler = mcpHandler || {
      sendCallTool: async (payload: Omit<CallToolMessage, 'type' | 'source'> | CallToolMessage) => {
        console.warn('Mock mcpHandler: sendCallTool called with:', payload);
        const call_id = payload.call_id; // Ensure call_id is accessible
        const name = payload.name; // Ensure name is accessible
        this.requestStatusState.setStatus('sending', `Sending ${name}...`, call_id);
        
        // This is a mock. In reality, the message goes to background.ts
        return Promise.resolve(); 
      },
    }; 
    console.log('BaseAdapter initialized');
  }

  abstract initializeObserver(): void;

  public checkCurrentUrl?(): void {
    console.log('BaseAdapter: checkCurrentUrl not implemented by default.');
  }

  public cleanup?(): void {
    console.log('BaseAdapter: cleanup called.');
  }

  public insertTextIntoInput?(text: string): Promise<void> {
    console.warn('BaseAdapter: insertTextIntoInput not implemented.');
    return Promise.reject(new Error('insertTextIntoInput not implemented in this adapter.'));
  }

  public triggerSubmission?(): Promise<void> {
    console.warn('BaseAdapter: triggerSubmission not implemented.');
    return Promise.reject(new Error('triggerSubmission not implemented in this adapter.'));
  }

  public getChatInputElement?(): HTMLTextAreaElement | HTMLInputElement | null {
    console.warn('BaseAdapter: getChatInputElement not implemented.');
    return null;
  }
  
  public showErrorFeedback?(message: string): void {
    console.error(`Adapter Error Feedback: ${message}`);
    this.requestStatusState.setStatus('error', message);
  }

  public initAIStudioComponents?(): void {
    console.log('BaseAdapter: initAIStudioComponents not implemented by default.');
  }
}