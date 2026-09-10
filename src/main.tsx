import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { I18nProvider } from './i18n/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Admin } from './admin/Admin'
import { Privacy } from './pages/Privacy'
import { Partner } from './partner/Partner'

// Routes: /admin (dashboard), /privacy (privacyverklaring),
// /partner/<slug> (kassascherm van een Pontdeal-partner), verder de app.
const path = window.location.pathname.replace(/\/+$/, '')
const isAdminRoute = path === '/admin' || path === '/admin/join'
const isPrivacy = path === '/privacy'
const isPartner = /^\/partner\/[^/]+$/.test(path)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isAdminRoute ? (
        <Admin />
      ) : isPartner ? (
        <Partner />
      ) : isPrivacy ? (
        <Privacy />
      ) : (
        <I18nProvider>
          <App />
        </I18nProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
