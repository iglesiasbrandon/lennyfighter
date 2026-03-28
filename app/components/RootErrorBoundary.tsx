'use client';

import { ErrorBoundary } from './ErrorBoundary';

export function RootErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallbackAction="reload">
      {children}
    </ErrorBoundary>
  );
}
