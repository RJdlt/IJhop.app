import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { I18nProvider } from './i18n/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Admin } from './admin/Admin'

// Eigen, afgeschermd dashboard op /admin; verder de gewone app.
const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin'

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
