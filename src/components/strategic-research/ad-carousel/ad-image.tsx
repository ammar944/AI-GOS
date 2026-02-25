"use client";

import * as React from "react";
import Image from "next/image";

export interface AdImageProps {
  src: string;
  alt: string;
  onError: () => void;
}

export function AdImage({ src, alt, onError }: AdImageProps) {
  const [fallbackLevel, setFallbackLevel] = React.useState(0);

  const shouldUseProxy = (url: string) => {
    const proxyDomains = [
      'googlesyndication.com',
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
    ];
    return proxyDomains.some(d => url.includes(d));
  };

  const getProxyUrl = (url: string) => {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  };

  const handleNextImageError = () => {
    setFallbackLevel(1);
  };

  const handleNativeError = () => {
    if (shouldUseProxy(src)) {
      setFallbackLevel(2);
    } else {
      setFallbackLevel(3);
      onError();
    }
  };

  const handleProxyError = () => {
    setFallbackLevel(3);
    onError();
  };

  if (fallbackLevel >= 3) {
    return null;
  }

  if (fallbackLevel === 2) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getProxyUrl(src)}
        alt={alt}
        className="w-full h-full object-cover"
        onError={handleProxyError}
      />
    );
  }

  if (fallbackLevel === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={handleNativeError}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      unoptimized
      onError={handleNextImageError}
    />
  );
}
