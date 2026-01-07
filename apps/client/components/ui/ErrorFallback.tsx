import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { FallbackProps } from 'react-error-boundary';

interface ErrorFallbackProps extends FallbackProps {
    level?: 'root' | 'feature' | 'component';
    name?: string;
}

/**
 * Error Fallback UI Component
 * 
 * Displays user-friendly error message with retry option.
 * Different layouts based on error boundary level.
 */
export function ErrorFallback({
    error,
    resetErrorBoundary,
    level = 'component',
    name = 'Unknown'
}: ErrorFallbackProps) {
    const isRootLevel = level === 'root';
    const isDev = __DEV__;

    return (
        <View style={[
            styles.container,
            isRootLevel && styles.rootContainer
        ]}>
            <View style={styles.content}>
                {/* Icon */}
                <Text style={styles.icon}>⚠️</Text>

                {/* Title */}
                <Text style={styles.title}>
                    {isRootLevel ? 'App Error' : 'Something went wrong'}
                </Text>

                {/* Message */}
                <Text style={styles.message}>
                    {isRootLevel
                        ? 'The app encountered an unexpected error. Please try reloading.'
                        : `There was a problem loading this ${level === 'feature' ? 'feature' : 'component'}.`
                    }
                </Text>

                {/* Error details (dev only) */}
                {isDev && (
                    <View style={styles.errorDetails}>
                        <Text style={styles.errorName}>{name}</Text>
                        <Text style={styles.errorMessage}>{error.message}</Text>
                    </View>
                )}

                {/* Retry button */}
                <TouchableOpacity
                    style={styles.button}
                    onPress={resetErrorBoundary}
                >
                    <Text style={styles.buttonText}>
                        {isRootLevel ? 'Reload App' : 'Try Again'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
    },
    rootContainer: {
        flex: 1,
        backgroundColor: '#FFEFE3',
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
    },
    icon: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: Platform.select({
            web: 'Satoshi-Bold',
            default: 'Satoshi-Bold',
        }),
    },
    message: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 24,
        fontFamily: Platform.select({
            web: 'Satoshi-Regular',
            default: 'Satoshi-Regular',
        }),
    },
    errorDetails: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
        width: '100%',
    },
    errorName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#d32f2f',
        marginBottom: 4,
        fontFamily: Platform.select({
            web: 'Satoshi-Medium',
            default: 'Satoshi-Medium',
        }),
    },
    errorMessage: {
        fontSize: 12,
        color: '#666',
        fontFamily: Platform.select({
            web: 'Satoshi-Regular',
            default: 'Satoshi-Regular',
        }),
    },
    button: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        minWidth: 160,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        fontFamily: Platform.select({
            web: 'Satoshi-Medium',
            default: 'Satoshi-Medium',
        }),
    },
});
