// C:\Users\joaqu\mcpfiles\MCP-SuperAssistant-main\pages\content\src\adapters\common\baseAdapter.ts
/**
 * Base Site Adapter
 *
 * This file implements a base adapter class with common functionality
 * that can be extended by site-specific adapters.
 */

import type { SiteAdapter } from '../../utils/siteAdapter'; // Verifica esta ruta
import { logMessage } from '../../utils/helpers'; // Verifica esta ruta

export abstract class BaseAdapter implements SiteAdapter {
  abstract name: string;
  abstract hostname: string | string[];
  urlPatterns?: RegExp[];
  protected sidebarManager: any = null;

  protected abstract initializeObserver(forceReset?: boolean): void;
  protected initializeSidebarManager(): void {
    if (this.sidebarManager) {
      this.sidebarManager.initialize();
    }
  }

  abstract insertTextIntoInput(text: string): void;
  abstract triggerSubmission(): void;

  initialize(): void {
    logMessage(`Initializing ${this.name} adapter`);
    if (this.sidebarManager) {
      logMessage(`Initializing sidebar manager for ${this.name}`);
      this.initializeSidebarManager();
    } else {
      logMessage(`No sidebar manager found for ${this.name}`);
    }
    logMessage(`Initializing unified observer for ${this.name} elements`);
    this.initializeObserver(true);
  }

  cleanup(): void {
    logMessage(`Cleaning up ${this.name} adapter`);
    if (this.sidebarManager) {
      this.sidebarManager.destroy();
      this.sidebarManager = null;
    }
  }

  showSidebarWithToolOutputs(): void {
    if (this.sidebarManager) {
      this.sidebarManager.showWithToolOutputs();
      logMessage('Showing sidebar with tool outputs');
    }
  }

  toggleSidebar(): void {
    if (this.sidebarManager) {
      if (this.sidebarManager.getIsVisible()) {
        this.sidebarManager.hide();
      } else {
        this.sidebarManager.showWithToolOutputs();
        logMessage('Showing sidebar with tool outputs');
      }
    }
  }

  updateConnectionStatus(isConnected: boolean): void {
    logMessage(`Updating ${this.name} connection status: ${isConnected}`);
  }

  refreshSidebarContent(): void {
    logMessage(`Forcing sidebar content refresh for ${this.name}`);
    if (this.sidebarManager) {
      this.sidebarManager.refreshContent();
      logMessage('Sidebar content refreshed');
    }
  }

  supportsFileUpload(): boolean {
    return false;
  }

  async attachFile(file: File): Promise<boolean> {
    logMessage(`File attachment not supported for ${this.name}`);
    return Promise.resolve(false);
  }

  // --- NUEVO MÉTODO AÑADIDO ---
  /**
   * Gets the primary scrollable element for the site's main content area.
   * This method should be overridden by specific adapters that require auto-scrolling.
   * @returns The scrollable HTMLElement or null if not found or not applicable.
   */
  public getScrollableElement(): HTMLElement | null {
    logMessage(`[${this.name}Adapter] getScrollableElement() is not implemented.`);
    return null;
  }
  // --- FIN NUEVO MÉTODO ---
}