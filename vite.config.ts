import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  // loadEnv is what makes .env.local work here: Vite does not put .env files
  // into process.env, so reading that directly would silently ignore them.
  // Inline variables still win, since loadEnv also picks up prefixed ones.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // The node the dev server proxies to. Point this at a remote node to develop
  // the UI against one; every request, including the event socket, follows.
  const nodeUrl = env.VITE_NODE_URL || 'http://localhost:6876'

  return {
    plugins: [react(), tailwindcss()],
    base: '/',
    define: {
      // Where the node actually lives, for the UI to name when nothing answers.
      // In development that is the proxy target; in production the node serves
      // the page itself, so the page origin is the honest answer.
      __NODE_ADDRESS__: JSON.stringify(command === 'serve' ? nodeUrl : null),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: nodeUrl, changeOrigin: true },
        '/events': { target: nodeUrl, changeOrigin: true, ws: true },
      },
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      outDir: 'html/sandbox',
      emptyOutDir: true,
    },
  }
})
