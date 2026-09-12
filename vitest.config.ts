import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  define: {
    // vite.config.ts injects this for the app; vitest reads its own config, so
    // anything importing src/lib/ledger.ts needs it defined here too. `null`
    // matches production, where the page origin is the honest node address.
    __NODE_ADDRESS__: 'null',
  },
})
