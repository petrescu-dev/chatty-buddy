import type { RecordingState } from '../types';

interface RecordButtonProps {
  state: RecordingState;
  onToggle: () => void;
  disabled?: boolean;
}

export function RecordButton({ state, onToggle, disabled }: RecordButtonProps) {
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings for recording state */}
      {isRecording && (
        <>
          <div className="absolute w-24 h-24 rounded-full bg-accent-500/20 recording-pulse" />
          <div className="absolute w-20 h-20 rounded-full bg-accent-500/30 recording-pulse" style={{ animationDelay: '0.5s' }} />
        </>
      )}
      
      <button
        onClick={onToggle}
        disabled={disabled || isProcessing}
        className={`
          relative z-10 w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-300 transform
          ${isRecording 
            ? 'bg-accent-500 hover:bg-accent-600 scale-110 shadow-lg shadow-accent-500/40' 
            : isProcessing
              ? 'bg-surface-600 cursor-not-allowed'
              : 'bg-surface-700 hover:bg-surface-600 hover:scale-105'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:ring-offset-2 focus:ring-offset-surface-900
        `}
        aria-label={isRecording ? 'Stop recording' : isProcessing ? 'Processing...' : 'Start recording'}
      >
        {isProcessing ? (
          // Loading spinner
          <svg className="w-8 h-8 animate-spin text-surface-300" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isRecording ? (
          // Stop icon (square)
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Microphone icon
          <svg className="w-8 h-8 text-surface-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
