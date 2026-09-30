import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

// Offline support is optional; a blocked worker must not prevent rendering.
try { registerSW({ immediate: true, onRegisterError: () => {} }) } catch { /* Browser blocks service workers. */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
