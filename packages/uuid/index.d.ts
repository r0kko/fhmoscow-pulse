export const NIL: string;
export const MAX: string;
export const DNS: string;
export const URL: string;

export type UUIDBuffer = Uint8Array | Buffer | number[];
export type RandomOptions = {
  random?: UUIDBuffer;
  rng?: () => UUIDBuffer;
  msecs?: number;
  nsecs?: number;
  clockseq?: number;
  node?: UUIDBuffer;
};

export function v1(options?: RandomOptions): string;
export function v1(
  options: RandomOptions | undefined,
  buf: UUIDBuffer,
  offset?: number
): UUIDBuffer;
export function v3(
  name: string | UUIDBuffer,
  namespace: string | UUIDBuffer
): string;
export function v4(options?: RandomOptions): string;
export function v4(
  options: RandomOptions | undefined,
  buf: UUIDBuffer,
  offset?: number
): UUIDBuffer;
export function v5(
  name: string | UUIDBuffer,
  namespace: string | UUIDBuffer
): string;
export function v6(options?: RandomOptions): string;
export function v7(options?: RandomOptions): string;
export function v7(
  options: RandomOptions | undefined,
  buf: UUIDBuffer,
  offset?: number
): UUIDBuffer;
export function validate(uuid: string): boolean;
export function version(uuid: string): number;
export function parse(uuid: string): Uint8Array;
export function stringify(bytes: UUIDBuffer, offset?: number): string;
export function v1ToV6(uuid: string): string;
export function v6ToV1(uuid: string): string;

declare const uuid: {
  DNS: string;
  MAX: string;
  NIL: string;
  URL: string;
  parse: typeof parse;
  stringify: typeof stringify;
  v1: typeof v1;
  v1ToV6: typeof v1ToV6;
  v3: typeof v3 & { DNS: string; URL: string };
  v4: typeof v4;
  v5: typeof v5 & { DNS: string; URL: string };
  v6: typeof v6;
  v6ToV1: typeof v6ToV1;
  v7: typeof v7;
  validate: typeof validate;
  version: typeof version;
};

export default uuid;
