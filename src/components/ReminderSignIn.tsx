import { useEffect, useState } from 'react'
import { LoaderCircle, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
export default function ReminderSignIn({ token, onDone }: { token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname + window.location.search) }, [])
  const signIn = async () => {
    setBusy(true); setError('')
    try {
      if (!supabase) throw new Error('Sign in is temporarily unavailable.')
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' })
      if (error) throw error
      onDone()
    } catch { setError('This link has expired or has already been used. Request a fresh sign-in link to continue.') }
    finally { setBusy(false) }
  }
  return <main className="auth-shell"><section className="auth-card"><span className="kicker"><Mail size={15} /> Your daily moment</span><h1>Welcome back</h1><p>One small step is enough to begin. Continue to your private journal.</p>{error ? <><p role="alert" className="form-error">{error}</p><button className="auth-submit primary" onClick={onDone}>Request a fresh sign-in link</button></> : <button className="auth-submit primary" disabled={busy} onClick={signIn}>{busy && <LoaderCircle className="spin" size={17} />}Continue to my journal</button>}</section></main>
}
