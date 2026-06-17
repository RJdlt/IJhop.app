import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { I18nProvider } from './i18n/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Admin } from './admin/Admin'

// Afgeschermd dashboard op /admin (ook /admin/join landt hier); verder de app.
const path = window.location.pathname.replace(/\/+$/, '')
const isAdminRoute = path === '/admin' || path === '/admin/join'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isAdminRoute ? (
        <Admin />
      ) : (
        <I18nProvider>
          <App />
        </I18nProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
