'use client';

import { useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { useVoiceInput } from '@/hooks/use-voice-input';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  stopRecordingRef?: React.MutableRefObject<(() => void) | null>;
  disabled?: boolean;
  hasTranscript?: boolean;
  onClear?: () => void;
  compact?: boolean;
}

export function VoiceInputButton({ onTranscript, onRecordingChange, stopRecordingRef, disabled, hasTranscript, onClear, compact }: VoiceInputButtonProps) {
  const {
    isSupported,
    isRecording,
    isTranscribing,
    transcript,
    startRecording,
    stopRecording,
    error,
  } = useVoiceInput();

  // Fire onTranscript when transcript changes
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  // Notify parent of recording state changes
  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  // Expose stopRecording to parent via ref
  useEffect(() => {
    if (stopRecordingRef) {
      stopRecordingRef.current = stopRecording;
    }
  }, [stopRecordingRef, stopRecording]);

  const handleClick = () => {
    if (disabled || isTranscribing) return;
    if (hasTranscript && onClear) {
      onClear();
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Determine visual state
  const isError = !!error;
  const isDisabledState = !hasTranscript && (disabled || isTranscribing || !isSupported);

  const getIcon = () => {
    if (isTranscribing) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (!isSupported || isError) return <MicOff className="w-4 h-4" />;
    return <Mic className="w-4 h-4" />;
  };

  const getBackground = () => {
    if (compact) {
      if (isError) return 'rgba(239, 68, 68, 0.12)';
      if (isRecording) return 'rgba(249, 115, 22, 0.12)';
      if (isTranscribing) return 'rgba(249, 115, 22, 0.08)';
      return 'transparent';
    }
    if (isError) return 'rgba(239, 68, 68, 0.15)';
    if (isRecording) return 'rgba(249, 115, 22, 0.15)';
    if (isTranscribing) return 'rgba(249, 115, 22, 0.1)';
    if (hasTranscript) return 'rgba(54, 94, 255, 0.08)';
    return 'var(--bg-surface)';
  };

  const getColor = () => {
    if (isError) return '#ef4444';
    if (isRecording) return '#f97316';
    if (isTranscribing) return '#f97316';
    if (hasTranscript) return 'var(--accent-blue)';
    if (!isSupported) return 'var(--text-quaternary)';
    return 'var(--text-tertiary)';
  };

  const getTitle = () => {
    if (error) return error;
    if (!isSupported) return 'Voice input not supported in this browser';
    if (isTranscribing) return 'Transcribing...';
    if (isRecording) return 'Click to stop recording';
    if (hasTranscript) return 'Re-record voice input';
    return 'Click to start voice input';
  };

  const sizeClass = compact ? 'w-8 h-8' : 'w-10 h-10';

  return (
    <MagneticButton
      type="button"
      onClick={handleClick}
      disabled={isDisabledState}
      className={`${sizeClass} rounded-lg flex items-center justify-center ${
        isRecording ? 'voice-recording-pulse' : ''
      }`}
      style={{
        background: getBackground(),
        border: compact
          ? 'none'
          : `1px solid ${isRecording ? '#f97316' : hasTranscript ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
        color: getColor(),
        opacity: isDisabledState && !isTranscribing ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}
      title={getTitle()}
    >
      {getIcon()}
    </MagneticButton>
  );
}
