export {};

declare global {
  interface Window {
    __csrfHmac?: string;
  }
}
