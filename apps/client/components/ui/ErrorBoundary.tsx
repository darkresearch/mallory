import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    level?: 'root' | 'feature' | 'component';
    name?: string;
}

/**
 * Reusable Error Boundary component
 * 
 * Wraps components to catch errors and show fallback UI instead of crashing.
 * 
 * @param level - Error boundary level (root/feature/component) for logging context
 * @param name - Component/feature name for error tracking
 */
export function ErrorBoundary({
    children,
    level = 'component',
    name = 'Unknown'
}: ErrorBoundaryProps) {
    const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
        // Log error with context
        console.error(`[ErrorBoundary:${level}:${name}] Error caught:`, {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
        });

        // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
        // Example: Sentry.captureException(error, { tags: { level, name } });
    };

    return (
        <ReactErrorBoundary
            FallbackComponent={(props) => <ErrorFallback {...props} level={level} name={name} />}
            onError={handleError}
            onReset={() => {
                // Optional: Clear any error state, reload data, etc.
                console.log(`[ErrorBoundary:${level}:${name}] Reset triggered`);
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
}
