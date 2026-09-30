import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (this.state.failed) return <main className="loading-screen" role="alert">
      <h1>We could not open your journal</h1>
      <p>Please reload and try again. Reloading does not clear your saved entries.</p>
      <button className="primary" onClick={() => window.location.reload()}>Reload journal</button>
    </main>
    return this.props.children
  }
}
