import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Vangnet voor onverwachte render-fouten: toont de foutmelding + een herlaadknop
 * i.p.v. een blanco scherm, zodat een crash zichtbaar en herstelbaar is. Bewust
 * met inline-stijlen (werkt ook als CSS/i18n niet geladen is).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App-crash:', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#0f172a',
          background: '#eef2ff',
        }}
      >
        <p style={{ fontSize: '40px', margin: 0 }}>🛟</p>
        <p style={{ fontWeight: 700, fontSize: '18px', margin: 0 }}>Er ging iets mis</p>
        <pre
          style={{
            maxWidth: '90%',
            whiteSpace: 'pre-wrap',
            fontSize: '12px',
            color: '#475569',
            margin: 0,
          }}
        >
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            borderRadius: '999px',
            border: 'none',
            background: '#1D9E75',
            color: '#fff',
            fontWeight: 600,
            padding: '10px 20px',
            fontSize: '14px',
          }}
        >
          Opnieuw laden
        </button>
      </div>
    )
  }
}
