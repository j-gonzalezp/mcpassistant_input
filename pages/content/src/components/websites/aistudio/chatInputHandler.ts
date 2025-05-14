/**
 * Chat Input Handler
 *
 * Utility functions for interacting with the AiStudio chat input area
 */

import { logMessage } from '@src/utils/helpers';

/**
 * Find the AiStudio chat input textarea element with retries.
 * @param timeout Max time to wait for the element in milliseconds.
 * @returns Promise resolving to the chat input textarea element or null if not found.
 */
export const findChatInputElement = async (timeout: number = 5000): Promise<HTMLTextAreaElement | null> => {
  // +++ LOGGING MODIFICADO/AÑADIDO +++
  logMessage(`[findChatInputElement] Starting search. Timeout: ${timeout}ms`);
  const startTime = Date.now();
  const selectorsToTry: string[] = [
    'textarea[placeholder="Start typing a prompt"]',
    'textarea[aria-label="Start typing a prompt"]',
    'textarea.textarea[placeholder="Start typing a prompt"]',
    'ms-autosize-textarea textarea[placeholder="Start typing a prompt"]',
    'textarea[placeholder="Ask follow-up"]',
    'textarea[placeholder*="Ask"]',
  ];

  while (Date.now() - startTime < timeout) {
    for (const selector of selectorsToTry) {
      // logMessage(`[findChatInputElement] Trying selector: ${selector}`); // Log opcional, puede ser muy verboso
      try {
        const chatInput = document.querySelector(selector);
        if (chatInput && chatInput instanceof HTMLTextAreaElement) {
          logMessage(`[findChatInputElement] SUCCESS: Found AiStudio input with selector: ${selector}`);
          return chatInput;
        }
      } catch (e) {
        logMessage(`[findChatInputElement] ERROR with selector "${selector}": ${e}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  logMessage(`[findChatInputElement] FAILURE: Could not find AiStudio input textarea after ${timeout}ms.`);
  console.warn('[MCP Extension] AiStudio chat input textarea not found after timeout (logged from findChatInputElement).');
  return null;
};

export const wrapInToolOutput = (content: string): string => {
  return `<tool_output>\\n${content}\\n</tool_output>`;
};

export const formatAsJson = (data: any): string => {
  return JSON.stringify(data, null, 2);
};

export const insertTextToChatInput = async (text: string): Promise<boolean> => {
  // +++ LOGGING AÑADIDO +++
  logMessage('[insertTextToChatInput] Attempting to insert text. Calling findChatInputElement...');
  try {
    const chatInput = await findChatInputElement();

    if (chatInput) {
      logMessage('[insertTextToChatInput] Input element found. Appending text.');
      const currentText = chatInput.value;
      const formattedText = currentText ? `${currentText}\\n\\n${text}` : text;
      chatInput.value = formattedText;

      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      chatInput.dispatchEvent(inputEvent);
      
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      chatInput.dispatchEvent(changeEvent);

      chatInput.focus();
      chatInput.selectionStart = chatInput.selectionEnd = chatInput.value.length;

      logMessage('[insertTextToChatInput] SUCCESS: Appended text to AiStudio chat input.');
      return true;
    } else {
      logMessage('[insertTextToChatInput] FAILURE: Could not find AiStudio chat input (it was null).');
      return false;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMessage(`[insertTextToChatInput] ERROR inserting text: ${errorMessage}`);
    console.error('[MCP Extension] Error inserting text into chat input:', error);
    return false;
  }
};

export const insertToolResultToChatInput = async (result: any): Promise<boolean> => {
  // +++ LOGGING AÑADIDO +++
  logMessage('[insertToolResultToChatInput] Preparing to insert tool result.');
  try {
    let textToInsert = result;
    if (typeof result !== 'string') {
      textToInsert = JSON.stringify(result, null, 2);
      logMessage('[insertToolResultToChatInput] Converted tool result to JSON string format.');
    }
    logMessage('[insertToolResultToChatInput] Calling insertTextToChatInput...');
    return await insertTextToChatInput(textToInsert);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMessage(`[insertToolResultToChatInput] ERROR formatting/inserting tool result: ${errorMessage}`);
    console.error('[MCP Extension] Error formatting/inserting tool result:', error);
    return false;
  }
};

export const attachFileToChatInput = async (file: File): Promise<boolean> => {
  logMessage(`[attachFileToChatInput] Attempting to attach file: ${file.name}. Calling findChatInputElement...`);
  try {
    const chatInput = await findChatInputElement(); 

    if (!chatInput) {
      logMessage('[attachFileToChatInput] FAILURE: Could not find AiStudio input element for file attachment.');
      return false;
    }
    logMessage('[attachFileToChatInput] Input element found. Proceeding with attachment.');

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });
    chatInput.dispatchEvent(dragOverEvent);
    
    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
    chatInput.dispatchEvent(dropEvent);
    
    logMessage(`[attachFileToChatInput] Dispatched drag/drop events for file ${file.name}.`);

    try {
      await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
      chatInput.focus();
      logMessage('[attachFileToChatInput] File copied to clipboard as fallback.');
    } catch (clipboardError) {
      logMessage(`[attachFileToChatInput] Could not copy to clipboard: ${clipboardError}`);
    }
    logMessage('[attachFileToChatInput] SUCCESS (attachment attempted).');
    return true; 
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMessage(`[attachFileToChatInput] ERROR attaching file: ${errorMessage}`);
    console.error('[MCP Extension] Error attaching file to AiStudio input:', error);
    return false;
  }
};

export const submitChatInput = async (maxWaitTime: number = 5000): Promise<boolean> => {
  logMessage('[submitChatInput] Attempting to submit chat. Calling findChatInputElement...');
  try {
    const chatInput = await findChatInputElement(); 

    if (!chatInput) {
      logMessage('[submitChatInput] FAILURE: Could not find chat input to submit.');
      return false;
    }
    logMessage('[submitChatInput] Input element found. Proceeding with submission strategies.');

    const findAndClickSubmitButton = async (): Promise<boolean> => {
      logMessage('[submitChatInput] Strategy 1: findAndClickSubmitButton START');
      // ... (resto de la lógica de findAndClickSubmitButton como la tenías, con sus logs internos) ...
      const submitButtonSelectors = [
        'button[aria-label="Submit"]', 'button[aria-label="Send"]', 
        'button[aria-label*="Send message"]', 'button[data-testid="send-button"]',
        'button[type="submit"]',
      ];
      let submitButton: HTMLButtonElement | null = null;
      for (const selector of submitButtonSelectors) {
        submitButton = document.querySelector(selector) as HTMLButtonElement | null;
        if (submitButton) {
          logMessage(`[submitChatInput] Found submit button with selector: ${selector}`);
          break;
        }
      }
      if (submitButton) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
          const isDisabled = submitButton.disabled || submitButton.getAttribute('aria-disabled') === 'true' || submitButton.classList.contains('disabled');
          if (!isDisabled) {
            logMessage('[submitChatInput] Submit button is enabled, clicking it.');
            submitButton.click();
            return true;
          }
          logMessage('[submitChatInput] Submit button is disabled, waiting...');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        logMessage(`[submitChatInput] Submit button remained disabled after ${maxWaitTime}ms.`);
        return false;
      }
      logMessage('[submitChatInput] No specific submit button found via selectors.');
      return false;
    };

    if (await findAndClickSubmitButton()) {
      logMessage('[submitChatInput] SUCCESS via findAndClickSubmitButton.');
      return true;
    }

    logMessage('[submitChatInput] Strategy 2: Simulating Enter key press START');
    chatInput.focus();
    const dispatchKeyboardEvent = (type: string, keyOptions: KeyboardEventInit) => {
      chatInput.dispatchEvent(new KeyboardEvent(type, { ...keyOptions, bubbles: true, cancelable: true }));
    };
    const enterKeyOptions: KeyboardEventInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    dispatchKeyboardEvent('keydown', enterKeyOptions);
    dispatchKeyboardEvent('keyup', enterKeyOptions);
    logMessage('[submitChatInput] Simulated Enter key press.');
    
    const form = chatInput.closest('form');
    if (form) {
      logMessage('[submitChatInput] Strategy 3: Found parent form, attempting to submit it.');
      form.requestSubmit ? form.requestSubmit() : form.submit();
      logMessage('[submitChatInput] Parent form submission attempted.');
      return true;
    }
    
    logMessage('[submitChatInput] All submission strategies attempted.');
    return true; 
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMessage(`[submitChatInput] ERROR submitting chat: ${errorMessage}`);
    console.error('[MCP Extension] Error submitting chat input:', error);
    return false;
  }
};