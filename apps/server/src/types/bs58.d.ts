declare module 'bs58' {
  export function encode(buffer: Uint8Array | Buffer): string;
  export function decode(str: string): Uint8Array;
  export default {
    encode,
    decode,
  };
}

