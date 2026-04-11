export {};

declare global {
  interface Window {
    alogiApp?: {
      quit: () => Promise<void>;
    };
  }
}
