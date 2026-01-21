import type { ChatResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function sendAudioMessage(audioBlob: Blob): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${errorText}`);
  }

  return response.json();
}

export function base64ToAudioUrl(base64: string, mimeType = 'audio/wav'): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}
