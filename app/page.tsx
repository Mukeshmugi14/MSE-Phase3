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
    let currentEmail = email;
    if (!currentEmail) {
      const inputEl = document.getElementById('email-input') as HTMLInputElement;
      if (inputEl && inputEl.value) {
        currentEmail = inputEl.value.trim();
        setEmail(currentEmail);
      }
    }

    if (!currentEmail) {
      setError('Please enter an email address.');
      return;
    }
    
    setLoading(true); setError('')
    
    try {
      const res = await fetch('/api/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail })
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
    <div className="min-h-screen flex selection:bg-teal-100 selection:text-teal-900" style={{ background: 'var(--cream-100)' }}>
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-16 relative overflow-hidden"
        style={{ background: 'var(--navy-800)' }}
      >
        {/* Abstract background glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-teal-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-navy-400/10 blur-[100px] rounded-full" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-900/40 transition-transform hover:scale-105 active:scale-95"
               style={{ background: 'linear-gradient(135deg, var(--teal-400), var(--teal-600))' }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a2 2 0 110 4 2 2 0 010-4zm0 10.4c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                fill="white"/>
            </svg>
          </div>
          <span className="text-white font-display text-2xl font-black tracking-tighter uppercase italic">AI-MSE</span>
        </div>

        {/* Main headline */}
        <div className="relative z-10">
          <p className="text-[10px] mb-6 font-black tracking-[0.3em] uppercase opacity-60"
             style={{ color: 'var(--teal-400)' }}>
            Precision Clinical Intelligence
          </p>
          <h1 className="font-display text-6xl font-black leading-[1.1] text-white mb-8 tracking-tight">
            Advanced<br/>
            Multimodal<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-teal-500 italic">Assessment</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-lg font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            AI-MSE bridges the gap between raw data and clinical intuition. 
            Analyze facial affect, acoustic prosody, and linguistic markers in a single, unified workflow.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-6 relative z-10">
          {[
            { value: '10', label: 'MSE Domains' },
            { value: '5K+', label: 'Clinical Markers' },
            { value: '0.9s', label: 'Inference Latency' },
          ].map(s => (
            <div key={s.label}
                 className="p-5 rounded-3xl backdrop-blur-md transition-all hover:bg-white/[0.08]"
                 style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-display text-2xl font-black text-white">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-40" style={{ color: 'white' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-[20%] right-[-5%] w-64 h-64 bg-teal-500/5 blur-[80px] rounded-full" />
        <div className="absolute bottom-[10%] left-[-5%] w-48 h-48 bg-navy-500/5 blur-[60px] rounded-full" />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
                 style={{ background: 'var(--teal-600)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3a2 2 0 110 4 2 2 0 010-4zm0 10.4c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/>
              </svg>
            </div>
            <span className="font-black text-xl tracking-tighter" style={{ color: 'var(--navy-900)' }}>AI-MSE</span>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="font-display text-4xl font-black mb-3 tracking-tighter" style={{ color: 'var(--navy-900)' }}>
              {step === 'email' ? 'Welcome back' : 'Check your inbox'}
            </h2>
            <p className="text-sm font-medium mb-10 leading-relaxed" style={{ color: 'rgba(13,31,56,0.5)' }}>
              {step === 'email'
                ? 'Sign in to access your secure clinical workspace.'
                : `We've sent a 6-digit verification code to your registered email address.`}
            </p>

            <div className="space-y-6">
              {step === 'email' ? (
                <>
                  <div className="group">
                    <label className="block text-[10px] font-black mb-2 tracking-[0.2em] uppercase transition-colors group-focus-within:text-teal-600"
                           style={{ color: 'rgba(13,31,56,0.4)' }}>
                      Clinical Email
                    </label>
                    <div className="relative">
                      <input
                        id="email-input"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendOtp()}
                        placeholder="you@hospital-domain.com"
                        className="w-full px-5 py-4 rounded-2xl text-sm outline-none transition-all shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-teal-500/50 focus:shadow-xl focus:shadow-teal-900/5"
                        style={{
                          background: 'white',
                          color: 'var(--navy-900)',
                        }}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal-600)" strokeWidth="2.5">
                          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={sendOtp}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl text-xs font-black text-white uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, var(--teal-600), var(--navy-800))',
                    }}
                  >
                    {loading ? 'Authenticating…' : 'Initialize Session'}
                  </button>
                </>
              ) : (
                <>
                  <div className="group">
                    <label className="block text-[10px] font-black mb-4 tracking-[0.2em] uppercase text-center"
                           style={{ color: 'rgba(13,31,56,0.4)' }}>
                      Identity Verification Code
                    </label>
                    <div className="flex justify-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                        placeholder="0 0 0 0 0 0"
                        className="w-full max-w-[280px] px-4 py-5 rounded-3xl text-2xl outline-none font-black tracking-[0.5em] text-center transition-all shadow-inner bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500/50 focus:shadow-2xl"
                        style={{
                          color: 'var(--teal-700)',
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={verifyOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full py-4 rounded-2xl text-xs font-black text-white uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, var(--teal-600), var(--navy-800))',
                    }}
                  >
                    {loading ? 'Verifying Integrity…' : 'Access Dashboard'}
                  </button>
                  <button
                    onClick={() => { setStep('email'); setOtp(''); setError('') }}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest hover:text-navy-900 transition-colors"
                    style={{ color: 'rgba(13,31,56,0.4)' }}
                  >
                    ← Re-enter Clinical Identity
                  </button>
                </>
              )}

              {error && (
                <div className="p-4 rounded-2xl text-[11px] font-bold flex items-start gap-3 animate-shake"
                     style={{ background: '#FFF1F2', color: 'var(--risk-high)', border: '1px solid #FFE4E6' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 flex-shrink-0">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {error}
                </div>
              )}
            </div>

            <p className="mt-12 text-[10px] text-center font-bold leading-relaxed uppercase tracking-widest opacity-30" style={{ color: 'var(--navy-900)' }}>
              Clinical Decision Support System<br/>
              Regulatory Compliance: DPDP ACT 2023
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
