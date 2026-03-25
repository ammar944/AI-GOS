'use client';

import { useState, useCallback } from 'react';

export interface UseSessionShareReturn {
  isSharing: boolean;
  shareUrl: string | null;
  copied: boolean;
  error: string | null;
  handleShare: (sessionId: string, title?: string) => Promise<void>;
  handleCopyLink: () => Promise<void>;
  resetShareState: () => void;
}

export function useSessionShare(): UseSessionShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = useCallback(async (sessionId: string, title?: string) => {
    setIsSharing(true);
    setError(null);

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title }),
      });

      const result = await response.json();

      if (result.success) {
        setShareUrl(result.shareUrl);
        // Auto-copy on successful share
        try {
          await navigator.clipboard.writeText(result.shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch {
          // Clipboard may fail — user can still manually copy
        }
      } else {
        setError(result.error || 'Failed to create share link');
      }
    } catch {
      setError('Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const resetShareState = useCallback(() => {
    setShareUrl(null);
    setError(null);
    setCopied(false);
  }, []);

  return {
    isSharing,
    shareUrl,
    copied,
    error,
    handleShare,
    handleCopyLink,
    resetShareState,
  };
}
