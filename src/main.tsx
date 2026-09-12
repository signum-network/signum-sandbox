import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Crypto } from '@signumjs/crypto'
import { WebCryptoAdapter } from '@signumjs/crypto/adapters'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { AudioProvider } from '@/audio'
import { router } from './router'
import './i18n'
import './index.css'

// Signing and message encryption go through this adapter; it must be set once,
// before any crypto function runs.
Crypto.init(new WebCryptoAdapter())

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AudioProvider>
          <RouterProvider router={router} />
        </AudioProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
