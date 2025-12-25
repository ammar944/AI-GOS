"use client";

import React from "react";
import { XCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global error boundary component that catches unhandled React errors
 * and displays a fallback UI with recovery options.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
          <div className="container mx-auto px-4 py-8 max-w-lg">
            <Card className="border-2 border-destructive/20">
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Something went wrong</h2>
                    <p className="text-muted-foreground">
                      An unexpected error occurred. Please try reloading the page.
                    </p>
                  </div>

                  {this.state.error && (
                    <div className="w-full rounded-lg bg-destructive/5 p-4 text-left overflow-auto max-h-32">
                      <pre className="text-sm text-destructive font-mono whitespace-pre-wrap break-words">
                        {this.state.error.message}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-3 w-full">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href="/">
                        <Home className="mr-2 h-4 w-4" />
                        Go Home
                      </Link>
                    </Button>
                    <Button className="flex-1" onClick={this.handleReload}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reload Page
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
