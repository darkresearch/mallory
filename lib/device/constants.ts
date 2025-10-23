/**
 * Device detection constants
 * Shared breakpoints and utilities for responsive behavior
 */

export const VIEWPORT_BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
} as const;

export type FormFactor = 'mobile' | 'tablet' | 'desktop';
export type Platform = 'ios' | 'android' | 'web';

export interface DeviceInfo {
  platform: Platform;
  viewportWidth: number;
  formFactor: FormFactor;
  isMobileWeb: boolean;
}

