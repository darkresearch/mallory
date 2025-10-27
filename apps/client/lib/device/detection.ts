/**
 * Device detection utilities
 * DRY utilities for detecting device type and form factor
 */

import { Platform } from 'react-native';
import { VIEWPORT_BREAKPOINTS, FormFactor, DeviceInfo } from './constants';

/**
 * Get form factor based on viewport width
 */
export function getFormFactor(width: number): FormFactor {
  if (width < VIEWPORT_BREAKPOINTS.MOBILE) return 'mobile';
  if (width < VIEWPORT_BREAKPOINTS.TABLET) return 'tablet';
  return 'desktop';
}

/**
 * Get complete device information
 */
export function getDeviceInfo(viewportWidth: number): DeviceInfo {
  const platform = Platform.OS as 'ios' | 'android' | 'web';
  const formFactor = getFormFactor(viewportWidth);
  const isMobileWeb = platform === 'web' && formFactor === 'mobile';

  return {
    platform,
    viewportWidth,
    formFactor,
    isMobileWeb,
  };
}

/**
 * Check if current device is mobile (native or web)
 */
export function isMobileDevice(device: DeviceInfo): boolean {
  return device.formFactor === 'mobile' || device.isMobileWeb;
}

/**
 * Check if current device is desktop
 */
export function isDesktopDevice(device: DeviceInfo): boolean {
  return device.formFactor === 'desktop';
}

