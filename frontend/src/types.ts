export interface Message {
  id: string;
  type: 'user' | 'agent';
  text: string;
  timestamp: Date;
  audioUrl?: string;
}

export interface ChatResponse {
  transcription: string;
  response: string;
  audioBase64: string;
}

export type RecordingState = 'idle' | 'recording' | 'processing';
