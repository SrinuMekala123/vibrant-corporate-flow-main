import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-destructive/20 shadow-xl text-center space-y-5 bg-background/95 backdrop-blur-md">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                {this.props.fallbackTitle || "Something went wrong"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {this.props.fallbackMessage ||
                  "An unexpected rendering error occurred. You can retry loading this section or reload the application."}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-[11px] text-muted-foreground font-mono text-left max-h-24 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="rounded-xl gap-2 text-xs h-9 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </Button>
              <Button
                size="sm"
                onClick={this.handleReload}
                className="gradient-primary text-white rounded-xl gap-2 text-xs h-9 font-medium shadow-glow"
              >
                <Home className="w-3.5 h-3.5" /> Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
