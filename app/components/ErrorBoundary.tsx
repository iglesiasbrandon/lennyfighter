'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackAction?: 'lobby' | 'reload';
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReturn = () => {
    this.setState({ hasError: false, errorMessage: null });
    if (this.props.fallbackAction === 'reload') {
      window.location.reload();
    } else {
      window.location.href = '/lobby';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '40px 20px',
            textAlign: 'center',
            fontFamily: "'VT323', monospace",
          }}
        >
          <div
            style={{
              background: 'var(--bg-dark, #1a1a2e)',
              border: '3px solid var(--gold-border, #c8a832)',
              borderRadius: '12px',
              padding: '40px 32px',
              maxWidth: '480px',
              width: '100%',
            }}
          >
            <h2
              style={{
                fontSize: '32px',
                color: 'var(--gold-border, #c8a832)',
                marginBottom: '16px',
              }}
            >
              Something Went Wrong
            </h2>
            <p
              style={{
                fontSize: '20px',
                color: 'var(--accent-red, #ef4444)',
                marginBottom: '24px',
                wordBreak: 'break-word',
              }}
            >
              {this.state.errorMessage}
            </p>
            <button
              className="btn btn-primary"
              onClick={this.handleReturn}
              style={{ fontSize: '22px', padding: '12px 32px' }}
            >
              {this.props.fallbackAction === 'reload' ? 'Reload Page' : 'Return to Lobby'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
