import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { router } from './app/router'
import { AuthProvider } from './auth/AuthProvider'
import { ConfigMissing } from './features/misc/ConfigMissing'
import './i18n'
import { isSupabaseConfigured } from './lib/supabase'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: '!rounded-xl !border-rule !bg-card !font-sans !text-ink !shadow-[var(--shadow-pop)]',
              error: '!text-stamp',
            },
          }}
        />
      </QueryClientProvider>
    ) : (
      <ConfigMissing />
    )}
  </StrictMode>,
)
