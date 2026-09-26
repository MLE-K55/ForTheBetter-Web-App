import { useState } from 'react'
import { ArrowRight, BookHeart, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !email) return
    setBusy(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (signInError) setError(signInError.message)
    else setSent(true)
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <span className="auth-logo"><BookHeart size={30} /></span>
      <span className="kicker">A private space to grow</span>
      <h1>For The Better</h1>
      <p>Your nine-week journal. Your honest answers. Your progress—visible only to you.</p>
      {sent ? <div className="email-sent"><Mail /><div><b>Check your email</b><span>We sent a secure sign-in link to {email}.</span></div></div> : <form onSubmit={signIn}>
        <label className="field"><span>Email address</span><div className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="email" required value={email} placeholder="you@example.com" onChange={event => setEmail(event.target.value)} /></div></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary auth-submit" disabled={busy}>{busy ? 'Sending…' : 'Send secure sign-in link'} <ArrowRight size={18} /></button>
      </form>}
      <div className="privacy-points"><span><ShieldCheck size={17} /> Private by design</span><span><KeyRound size={17} /> No password to remember</span></div>
    </section>
  </main>
}
