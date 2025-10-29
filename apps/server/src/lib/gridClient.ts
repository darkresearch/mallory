import { GridClient } from '@sqds/grid';

/**
 * Create a new GridClient instance
 * 
 * GridClient is stateful, so we need to create a fresh instance for each
 * request/operation to avoid state pollution between concurrent requests.
 * 
 * @returns A new GridClient instance configured with environment variables
 */
export function createGridClient(): GridClient {
  return new GridClient({
    environment: (process.env.GRID_ENV || 'production') as 'sandbox' | 'production',
    apiKey: process.env.GRID_API_KEY!,
    baseUrl: 'https://grid.squads.xyz'
  });
}

