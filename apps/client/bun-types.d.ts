declare module "bun" {
  export const plugin: any;
}

declare global {
  const Bun: {
    jest?: {
      mock: (module: string, factory: () => any) => void;
    };
  };
}

declare module "bun:test" {
  export function test(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  export namespace test {
    function skip(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  }
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  export function mock(module: string): any;
  export function register(module: string, factory: () => any): void;
  export function expect(value: any): {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toContain(expected: any): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(expected: number): void;
    toHaveBeenCalledWith(...args: any[]): void;
    not: any;
  };
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}
