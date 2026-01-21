import { useState, useCallback } from 'react';
import type { Message, RecordingState } from './types';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { sendAudioMessage, base64ToAudioUrl } from './api';
import { RecordButton } from './components/RecordButton';
import { AudioHistogram } from './components/AudioHistogram';
import { ChatHistory } from './components/ChatHistory';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    analyserNode,
    error: recorderError 
  } = useAudioRecorder();

  const handleToggleRecording = useCallback(async () => {
    setError(null);

    if (isRecording) {
      // Stop recording and send
      setRecordingState('processing');
      
      try {
        const audioBlob = await stopRecording();
        
        if (!audioBlob || audioBlob.size === 0) {
          throw new Error('No audio recorded');
        }

        // Send to server
        const response = await sendAudioMessage(audioBlob);

        // Add user message (transcription)
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          type: 'user',
          text: response.transcription,
          timestamp: new Date(),
        };

        // Convert base64 audio to URL
        const audioUrl = base64ToAudioUrl(response.audioBase64);

        // Add agent message
        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          text: response.response,
          timestamp: new Date(),
          audioUrl,
        };

        setMessages(prev => [...prev, userMessage, agentMessage]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process message';
        setError(message);
        console.error('Error processing message:', err);
      } finally {
        setRecordingState('idle');
      }
    } else {
      // Start recording
      setRecordingState('recording');
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const displayError = error || recorderError;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-surface-100">
                Chatty Buddy
              </h1>
              <p className="text-xs text-surface-500 mt-0.5">
                Voice-powered AI assistant
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-agent animate-pulse" />
                Online
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full overflow-hidden">
        <ChatHistory messages={messages} />
      </main>

      {/* Recording controls */}
      <footer className="flex-shrink-0 border-t border-surface-700/50 bg-surface-900/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Error display */}
          {displayError && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {displayError}
            </div>
          )}

          {/* Histogram */}
          <div className="mb-4">
            <AudioHistogram 
              analyserNode={analyserNode} 
              isRecording={recordingState === 'recording'} 
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-3">
            <RecordButton 
              state={recordingState}
              onToggle={handleToggleRecording}
            />
            
            <p className="text-xs text-surface-500 text-center">
              {recordingState === 'recording' 
                ? 'Recording... Click to stop and send'
                : recordingState === 'processing'
                  ? 'Processing your message...'
                  : 'Click to start recording'
              }
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
