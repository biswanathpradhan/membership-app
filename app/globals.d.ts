declare module "*.css";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elem: `s-${string}`]: Record<string, unknown>;
    }
  }
}
