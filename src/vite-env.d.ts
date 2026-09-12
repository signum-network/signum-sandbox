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
