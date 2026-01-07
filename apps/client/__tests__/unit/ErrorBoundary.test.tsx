/**
 * Unit Tests for ErrorBoundary Component Structure
 * 
 * Note: Full rendering tests are skipped because Bun test runner 
 * doesn't support React Native's Flow syntax out of the box.
 * We verify structure and imports instead.
 */

import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('ErrorBoundary Component', () => {
    const componentPath = path.join(__dirname, '../../components/ui/ErrorBoundary.tsx');
    const fallbackPath = path.join(__dirname, '../../components/ui/ErrorFallback.tsx');

    test('should exist', () => {
        expect(fs.existsSync(componentPath)).toBe(true);
        expect(fs.existsSync(fallbackPath)).toBe(true);
    });

    test('ErrorBoundary should import react-error-boundary', () => {
        const content = fs.readFileSync(componentPath, 'utf-8');
        expect(content).toContain('react-error-boundary');
        expect(content).toContain('ErrorBoundary');
        expect(content).toContain('ErrorFallback');
    });

    test('ErrorBoundary should handle different levels', () => {
        const content = fs.readFileSync(componentPath, 'utf-8');
        expect(content).toContain("level = 'component'");
        expect(content).toContain("name = 'Unknown'");
        expect(content).toContain('console.error'); // Should log errors
    });

    test('ErrorFallback should have retry button', () => {
        const content = fs.readFileSync(fallbackPath, 'utf-8');
        expect(content).toContain('TouchableOpacity');
        expect(content).toContain('onPress={resetErrorBoundary}');
        expect(content).toContain('Try Again');
    });

    test('ErrorFallback should handle root level', () => {
        const content = fs.readFileSync(fallbackPath, 'utf-8');
        expect(content).toContain("level === 'root'");
        expect(content).toContain('Reload App');
    });
});
