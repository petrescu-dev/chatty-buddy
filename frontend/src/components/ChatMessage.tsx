import type { Message } from '../types';
import { useRef, useEffect, useState } from 'react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isUser = message.type === 'user';

  // Auto-play agent responses
  useEffect(() => {
    if (message.type === 'agent' && message.audioUrl && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [message.type, message.audioUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4 ${isUser ? 'animate-slide-in-left' : 'animate-slide-in-right'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`flex items-end gap-2 ${isUser ? '' : 'flex-row-reverse'}`}>
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
            ${isUser ? 'bg-user/20 text-user' : 'bg-agent/20 text-agent'}
          `}>
            {isUser ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            )}
          </div>

          {/* Message bubble */}
          <div className={`
            relative px-4 py-3 rounded-2xl
            ${isUser 
              ? 'bg-surface-800 border border-surface-700 rounded-bl-md' 
              : 'bg-gradient-to-br from-surface-700 to-surface-800 border border-surface-600 rounded-br-md'
            }
          `}>
            <p className="text-surface-100 text-sm leading-relaxed whitespace-pre-wrap">
              {message.text}
            </p>

            {/* Audio player for agent messages */}
            {message.audioUrl && (
              <div className="mt-3 pt-3 border-t border-surface-600/50">
                <audio
                  ref={audioRef}
                  src={message.audioUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlayPause}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                      transition-all duration-200
                      ${isPlaying 
                        ? 'bg-agent/20 text-agent' 
                        : 'bg-surface-600/50 text-surface-300 hover:bg-surface-600 hover:text-surface-200'
                      }
                    `}
                  >
                    {isPlaying ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>Play</span>
                      </>
                    )}
                  </button>
                  {message.metrics && (
                    <span className="text-[10px] text-surface-500 font-mono">
                      STT {message.metrics.stt.durationMs}ms · LLM {message.metrics.llm.durationMs}ms · TTS {message.metrics.tts.durationMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className={`
              mt-1 text-[10px] text-surface-500
              ${isUser ? 'text-left' : 'text-right'}
            `}>
              {formatTime(message.timestamp)}
            </div>
          </div>
        </div>

        {/* Label */}
        <div className={`
          mt-1 text-[10px] font-medium uppercase tracking-wider
          ${isUser ? 'text-user/60 ml-10' : 'text-agent/60 mr-10 text-right'}
        `}>
          {isUser ? 'You' : 'Agent'}
        </div>
      </div>
    </div>
  );
}
