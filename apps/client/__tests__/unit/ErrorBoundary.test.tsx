/**
 * Unit Tests for ErrorBoundary Component
 */

import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
}

describe('ErrorBoundary Component', () => {
    // Suppress console.error for these tests
    const originalError = console.error;
    beforeAll(() => {
        console.error = () => { };
    });
    afterAll(() => {
        console.error = originalError;
    });

    describe('Error Catching', () => {
        test('should catch errors and show fallback UI', () => {
            render(
                <ErrorBoundary level="component" name="TestComponent">
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            );

            // Should show error fallback
            expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
            expect(screen.getByText(/Try Again/i)).toBeInTheDocument();
        });

        test('should render children when no error', () => {
            render(
                <ErrorBoundary level="component" name="TestComponent">
                    <ThrowError shouldThrow={false} />
                </ErrorBoundary>
            );

            // Should render children normally
            expect(screen.getByText('No error')).toBeInTheDocument();
            expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
        });
    });

    describe('Error Boundary Levels', () => {
        test('should show root-level error message', () => {
            render(
                <ErrorBoundary level="root" name="RootLayout">
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText(/App Error/i)).toBeInTheDocument();
            expect(screen.getByText(/Reload App/i)).toBeInTheDocument();
        });

        test('should show feature-level error message', () => {
            render(
                <ErrorBoundary level="feature" name="ChatManager">
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
            expect(screen.getByText(/problem loading this feature/i)).toBeInTheDocument();
        });

        test('should show component-level error message', () => {
            render(
                <ErrorBoundary level="component" name="DataPreloader">
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
            expect(screen.getByText(/problem loading this component/i)).toBeInTheDocument();
        });
    });

    describe('Error Details (Dev Mode)', () => {
        test('should show error details in dev mode', () => {
            // __DEV__ is true in test environment
            render(
                <ErrorBoundary level="component" name="TestComponent">
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            );

            // Should show component name and error message
            expect(screen.getByText('TestComponent')).toBeInTheDocument();
            expect(screen.getByText('Test error')).toBeInTheDocument();
        });
    });

    describe('Reset Functionality', () => {
        test('should have a reset button', () => {
            render(
                <ErrorBoundary level="component" name="TestComponent">
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            );

            const resetButton = screen.getByText(/Try Again/i);
            expect(resetButton).toBeInTheDocument();
        });
    });
});
