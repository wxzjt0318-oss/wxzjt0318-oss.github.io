export {};

declare global {
  interface Window {
    twikoo?: {
      init: (options: any) => void;
    };
  }
}
