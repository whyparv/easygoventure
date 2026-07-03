import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@shared/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches render-time errors in the subtree and shows a recoverable fallback.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private readonly reset = (): void => this.setState({ hasError: false, error: undefined });

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </p>
        <Button onClick={this.reset}>Try again</Button>
      </div>
    );
  }
}
