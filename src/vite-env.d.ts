/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: the node the Vite proxy forwards to. See vite.config.ts. */
  readonly VITE_NODE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Injected by vite.config.ts: the node's address in development, null in production. */
declare const __NODE_ADDRESS__: string | null

/**
 * hashicon@0.3.0 ships no typings. Declared just enough of its shape for
 * Identicon.tsx: a default export taking a hash string and returning the
 * canvas it drew.
 */
declare module 'hashicon' {
  export default function hashicon(hash: string, options?: { size?: number }): HTMLCanvasElement
}
