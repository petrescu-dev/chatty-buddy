import { useRef, useEffect } from 'react';

interface AudioHistogramProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export function AudioHistogram({ analyserNode, isRecording }: AudioHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const draw = () => {
      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(28, 25, 23, 0.9)');
      gradient.addColorStop(1, 'rgba(41, 37, 36, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (!analyserNode || !isRecording) {
        // Draw idle state - subtle bars
        const barCount = 32;
        const barWidth = (width / barCount) * 0.7;
        const gap = (width / barCount) * 0.3;
        
        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + gap) + gap / 2;
          const barHeight = 4 + Math.sin(Date.now() / 1000 + i * 0.3) * 2;
          const y = (height - barHeight) / 2;
          
          ctx.fillStyle = 'rgba(168, 162, 158, 0.3)';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
        
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Get frequency data
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      // Draw frequency bars
      const barCount = 32;
      const step = Math.floor(bufferLength / barCount);
      const barWidth = (width / barCount) * 0.7;
      const gap = (width / barCount) * 0.3;

      for (let i = 0; i < barCount; i++) {
        // Average several frequency bins for smoother visualization
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const average = sum / step;
        
        // Normalize and scale
        const normalized = average / 255;
        const barHeight = Math.max(4, normalized * height * 0.85);
        
        const x = i * (barWidth + gap) + gap / 2;
        const y = (height - barHeight) / 2;

        // Create gradient for bar
        const barGradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        const intensity = normalized;
        
        if (intensity > 0.7) {
          barGradient.addColorStop(0, '#fb923c'); // accent-400
          barGradient.addColorStop(1, '#f97316'); // accent-500
        } else if (intensity > 0.4) {
          barGradient.addColorStop(0, '#f97316'); // accent-500
          barGradient.addColorStop(1, '#ea580c'); // accent-600
        } else {
          barGradient.addColorStop(0, '#78716c'); // surface-500
          barGradient.addColorStop(1, '#57534e'); // surface-600
        }

        ctx.fillStyle = barGradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();

        // Add glow effect for high intensity bars
        if (intensity > 0.6) {
          ctx.shadowColor = '#fb923c';
          ctx.shadowBlur = 10 * intensity;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 rounded-lg border border-surface-700/50"
      style={{ width: '100%', height: '64px' }}
    />
  );
}
