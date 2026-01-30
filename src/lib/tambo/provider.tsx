"use client";

import { TamboProvider as BaseTamboProvider } from "@tambo-ai/react";
import { tamboComponents } from "./components";

interface TamboProviderProps {
  children: React.ReactNode;
}

export function TamboProvider({ children }: TamboProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY;

  if (!apiKey) {
    console.warn("Tambo API key not found. Set NEXT_PUBLIC_TAMBO_API_KEY in your .env.local");
    return <>{children}</>;
  }

  return (
    <BaseTamboProvider apiKey={apiKey} components={tamboComponents}>
      {children}
    </BaseTamboProvider>
  );
}
