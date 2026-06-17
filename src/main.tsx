import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { I18nProvider } from './i18n/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Admin } from './admin/Admin'
import { Join } from './admin/Join'

// Eigen, afgeschermde routes; verder de gewone app.
const path = window.location.pathname.replace(/\/+$/, '')
const route = path === '/admin/join' ? 'join' : path === '/admin' ? 'admin' : 'app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {route === 'admin' ? (
        <Admin />
      ) : route === 'join' ? (
        <Join />
      ) : (
        <I18nProvider>
          <App />
        </I18nProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
