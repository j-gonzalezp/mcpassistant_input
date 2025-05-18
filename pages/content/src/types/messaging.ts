// pages/content/src/types/messaging.ts

export interface MessageBase {
  type: string;
  source?: string; // Optional: Who originated the message (e.g., 'content-script', 'background', 'sidebar')
  call_id?: string; // Optional: For tracking specific requests/responses
}

// Messages from Content Script/UI to Background Script
export interface CallToolMessage extends MessageBase {
  type: 'CallTool'; // Or a more specific prefix like 'MCP_CALL_TOOL'
  call_id: string; // Required for CallTool to match results
  name: string;    // Tool name
  parameters: Record<string, any>;
}

// Messages from Background Script to Content Script/UI
export interface ToolContentItem {
  type: 'text' | 'json' | 'error_details'; // Could be extended
  text?: string;
  json?: any;
  // Add other content types as needed
}

export interface ToolResultMessage extends MessageBase {
  type: 'TOOL_CALL_RESULT';
  call_id: string;
  toolName?: string; // Name of the tool that was called
  isError: boolean;
  content: ToolContentItem[] | null; // Array for potential multi-part responses
  // If isError is true, content might contain error details
}

export interface ErrorMessage extends MessageBase {
  type: 'ERROR'; // General error message not tied to a specific tool call result
  message: string;
  details?: any;
}

export interface StatusUpdateMessage extends MessageBase {
    type: 'STATUS_UPDATE';
    status: 'sending' | 'processing' | 'success' | 'error' | 'idle';
    message?: string;
}

export interface PingMessage extends MessageBase {
    type: 'PING';
    payload?: any;
}

export interface PongMessage extends MessageBase {
    type: 'PONG';
    payload?: any;
}

// Union type for all possible messages if needed for type guards
export type Message = 
  | CallToolMessage
  | ToolResultMessage
  | ErrorMessage
  | StatusUpdateMessage
  | PingMessage
  | PongMessage;

// For McpHandler specifically if it lives in lib/mcp
// This defines the interface for whatever is handling the actual calls to the background/MCP server
export interface McpHandler {
  sendCallTool(payload: CallToolMessage | Omit<CallToolMessage, 'type' | 'source'>): Promise<void>;
  // Potentially other methods for managing connection, etc.
}