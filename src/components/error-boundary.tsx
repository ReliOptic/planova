import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Logger } from '../infrastructure/logger/logger';

/** Props accepted by the ErrorBoundary component. */
export interface ErrorBoundaryProps {
  /** Child tree to render when no error is present. */
  readonly children: ReactNode;
  /** Logger used to persist the caught error details. */
  readonly logger: Logger;
  /** Optional custom fallback UI. Defaults to the built-in Korean error panel. */
  readonly fallback?: ReactNode;
}

/** Internal state for the ErrorBoundary component. */
export interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error?: Error;
}

/**
 * ErrorBoundary — React class component that catches unhandled render errors.
 *
 * On error:
 *  - Persists the error via `props.logger.error`.
 *  - Renders a centered dark panel with a reload button and a log export button.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary logger={logger}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    this.props.logger.error('react/error-boundary', err.message, {
      stack: err.stack,
      componentStack: info.componentStack ?? undefined,
    });
  }

  private handleExportLogs = (): void => {
    this.props.logger
      .listRecent(500)
      .then((entries) => {
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planova-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((cause: unknown) => {
        console.error(JSON.stringify({ level: 'error', scope: 'error-boundary', message: 'export-failed', cause: String(cause) }));
      });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            앱에서 오류가 발생했습니다
          </h1>
          {this.state.error && (
            <p
              style={{
                fontSize: '0.875rem',
                color: '#94a3b8',
                marginBottom: '1.5rem',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              새로고침
            </button>
            <button
              onClick={this.handleExportLogs}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              로그 내보내기
            </button>
          </div>
        </div>
      </div>
    );
  }
}
