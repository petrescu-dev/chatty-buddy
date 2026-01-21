// structure for messages in the chat
export interface Message {
  id: string;
  type: 'user' | 'agent';
  text: string;
  timestamp: Date;
  audioUrl?: string;
  metrics?: ChatMetrics;
}

export interface ServiceMetrics {
  durationMs: number;
}

// metrics returned from the server
export interface ChatMetrics {
  stt: ServiceMetrics;
  llm: ServiceMetrics;
  tts: ServiceMetrics;
  total: ServiceMetrics;
}

// chat response returned from the server
export interface ChatResponse {
  transcription: string;
  response: string;
  audioBase64: string;
  metrics: ChatMetrics;
}

export type RecordingState = 'idle' | 'recording' | 'processing';
