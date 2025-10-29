/**
 * Expo Router Mock for Tests
 */

export const Stack = () => null;
export const Tabs = () => null;

export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => false,
  setParams: () => {},
});

export const usePathname = () => '/';
export const useSegments = () => [];
export const useLocalSearchParams = () => ({});

export const router = {
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => false,
  setParams: () => {},
};

export const Link = 'Link';
export const Redirect = 'Redirect';

