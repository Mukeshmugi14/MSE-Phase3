'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [otp, setOtp]           = useState('')
  const [step, setStep]         = useState<'email' | 'otp'>('email')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const supabase = createClient()
  const router   = useRouter()

  async function sendOtp() {
    if (!email) return
    setLoading(true); setError('')

    // TESTING BYPASS: Hit the local test-login route
    try {
      const res = await fetch('/api/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test login failed')

      // Set session manually on client-side to ensure middleware and hooks see it
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      })

      // Login successful, redirect immediately
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function verifyOtp() {
    if (!otp) return
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      // Upsert clinician profile
      await supabase.from('clinician_profiles').upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: data.user.email!.split('@')[0],
        role: 'psychiatrist',
        hospital: 'General Hospital',
        registration_number: 'MCI-00000',
      }, { onConflict: 'id' })
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--cream-100)' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-14"
        style={{ background: 'var(--navy-800)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--teal-400)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a2 2 0 110 4 2 2 0 010-4zm0 10.4c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                fill="white"/>
            </svg>
          </div>
          <span className="text-white font-display text-xl font-medium tracking-tight">AI-MSE</span>
        </div>

        {/* Main headline */}
        <div>
          <p className="text-sm mb-6 tracking-widest uppercase"
             style={{ color: 'var(--teal-400)', letterSpacing: '0.15em' }}>
            Clinical Decision Support
          </p>
          <h1 className="font-display text-5xl font-light leading-tight text-white mb-6">
            Intelligent<br/>
            Mental Status<br/>
            <em style={{ color: 'var(--teal-400)' }}>Examination</em>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            AI-assisted psychiatric assessment for India's clinical workforce.
            Real-time multimodal analysis. Clinician-grade precision.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-6">
          {[
            { value: '7', label: 'MSE Domains' },
            { value: '4+', label: 'Signal Modalities' },
            { value: '20+', label: 'Indian Languages' },
          ].map(s => (
            <div key={s.label}
                 className="p-4 rounded-xl"
                 style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <p className="font-display text-3xl font-light text-white">{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ background: 'var(--teal-600)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a2 2 0 110 4 2 2 0 010-4zm0 10.4c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/>
              </svg>
            </div>
            <span className="font-display text-xl font-medium" style={{ color: 'var(--navy-900)' }}>AI-MSE</span>
          </div>

          <div className="animate-in">
            <h2 className="font-display text-3xl font-medium mb-2" style={{ color: 'var(--navy-900)' }}>
              {step === 'email' ? 'Clinician sign-in' : 'Enter your code'}
            </h2>
            <p className="text-sm mb-10" style={{ color: 'rgba(13,31,56,0.5)' }}>
              {step === 'email'
                ? 'Enter your registered clinical email address'
                : `We sent a 6-digit code to ${email}`}
            </p>

            <div className="space-y-4">
              {step === 'email' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-2 tracking-wide uppercase"
                           style={{ color: 'rgba(13,31,56,0.5)' }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendOtp()}
                      placeholder="you@hospital.com"
                      className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                      style={{
                        background: 'white',
                        border: '1px solid rgba(13,31,56,0.15)',
                        color: 'var(--navy-900)',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--teal-600)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(13,31,56,0.15)'}
                    />
                  </div>
                  <button
                    onClick={sendOtp}
                    disabled={loading || !email}
                    className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-all"
                    style={{
                      background: loading || !email ? 'rgba(11,110,79,0.4)' : 'var(--teal-600)',
                      cursor: loading || !email ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Signing in…' : 'Sign in (Test Mode)'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-2 tracking-wide uppercase"
                           style={{ color: 'rgba(13,31,56,0.5)' }}>
                      Verification code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                      placeholder="000000"
                      className="w-full px-4 py-3.5 rounded-xl text-sm outline-none font-mono tracking-widest text-center transition-all"
                      style={{
                        background: 'white',
                        border: '1px solid rgba(13,31,56,0.15)',
                        color: 'var(--navy-900)',
                        letterSpacing: '0.3em',
                        fontSize: '1.25rem',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--teal-600)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(13,31,56,0.15)'}
                    />
                  </div>
                  <button
                    onClick={verifyOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-all"
                    style={{
                      background: loading || otp.length < 6 ? 'rgba(11,110,79,0.4)' : 'var(--teal-600)',
                      cursor: loading || otp.length < 6 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Verifying…' : 'Sign in'}
                  </button>
                  <button
                    onClick={() => { setStep('email'); setOtp(''); setError('') }}
                    className="w-full py-2.5 text-sm"
                    style={{ color: 'rgba(13,31,56,0.5)' }}
                  >
                    ← Back
                  </button>
                </>
              )}

              {error && (
                <div className="p-3 rounded-lg text-sm"
                     style={{ background: '#FEF2F2', color: 'var(--risk-high)', border: '1px solid #FECACA' }}>
                  {error}
                </div>
              )}
            </div>

            <p className="mt-10 text-xs text-center" style={{ color: 'rgba(13,31,56,0.35)' }}>
              AI-MSE is a clinical decision-support tool. It does not autonomously diagnose.
              All assessments require clinician review and validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
