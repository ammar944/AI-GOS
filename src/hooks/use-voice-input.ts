'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface UseVoiceInputReturn {
  isSupported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  startRecording: () => void;
  stopRecording: () => void;
  error: string | null;
  reset: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Check MediaRecorder support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined') {
      setIsSupported(true);
    }
  }, []);

  // Auto-clear error after 3s
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      abortRef.current?.abort();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Release mic immediately
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setError('No audio recorded');
          return;
        }

        // Convert blob → base64 → POST to Groq Whisper
        setIsTranscribing(true);
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const simpleMime = mimeType.split(';')[0];

          const controller = new AbortController();
          abortRef.current = controller;

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64, mimeType: simpleMime }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || `Transcription failed (${res.status})`);
          }

          const data = await res.json();
          if (data.text) {
            setTranscript(data.text);
          } else {
            setError('No speech detected');
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setIsTranscribing(false);
          abortRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setTranscript('');
      setError(null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied');
      } else {
        setError('Could not access microphone');
      }
    }
  }, [isRecording, isTranscribing]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    setIsRecording(false);
    setIsTranscribing(false);
  }, []);

  return {
    isSupported,
    isRecording,
    isTranscribing,
    transcript,
    startRecording,
    stopRecording,
    error,
    reset,
  };
}
