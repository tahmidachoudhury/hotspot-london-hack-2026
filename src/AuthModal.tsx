import { useState, type CSSProperties, type FormEvent } from 'react';
import { signIn, signUp } from './lib/auth';
import { pal } from './palette';
import { ACCENT } from './VideoCard';

const p = pal('Paper');

type Style = CSSProperties & Record<string, unknown>;

const S: Record<string, Style> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'rgba(14,10,16,.45)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    animation: 'hsFade .16s ease',
  },
  panel: {
    width: '100%',
    maxWidth: '380px',
    borderRadius: '22px',
    background: p.panel,
    border: '1px solid ' + p.line,
    boxShadow: '0 40px 90px -30px rgba(20,10,20,.55)',
    padding: '28px 26px 24px',
  },
  eyebrow: { font: "700 11px 'Archivo',sans-serif", letterSpacing: '1.6px', textTransform: 'uppercase', color: ACCENT, marginBottom: '4px' },
  title: { font: "600 26px/1.1 'Oswald',sans-serif", color: p.ink, margin: 0 },
  sub: { font: "400 13.5px/1.5 'Archivo',sans-serif", color: p.mut, margin: '8px 0 18px' },
  input: {
    width: '100%',
    height: '46px',
    padding: '0 16px',
    marginBottom: '10px',
    borderRadius: '13px',
    border: '1px solid ' + p.line,
    background: p.bg,
    font: "500 14px 'Archivo',sans-serif",
    color: p.ink,
    outline: 'none',
  },
  submit: {
    width: '100%',
    height: '46px',
    marginTop: '4px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    background: ACCENT,
    color: '#fff',
    font: "600 14px 'Archivo',sans-serif",
  },
  error: { font: "500 12.5px/1.4 'Archivo',sans-serif", color: '#c22f45', margin: '4px 2px 8px' },
  info: { font: "500 12.5px/1.4 'Archivo',sans-serif", color: '#1d7a53', margin: '4px 2px 8px' },
  switchRow: { textAlign: 'center', font: "500 13px 'Archivo',sans-serif", color: p.mut, marginTop: '16px' },
  switchBtn: { border: 'none', background: 'none', cursor: 'pointer', color: ACCENT, font: "600 13px 'Archivo',sans-serif", padding: 0 },
};

export interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { data, error: err } = isSignup ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      onClose(); // signed in — hearts now persist
    } else {
      // Signup succeeded but email confirmation is enabled in Supabase.
      setInfo('Check your inbox to confirm your email, then sign in.');
      setMode('signin');
    }
  };

  return (
    <div style={S.overlay} onMouseDown={onClose}>
      <div style={S.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.eyebrow}>Hotspot</div>
        <h2 style={S.title}>{isSignup ? 'Start your collection' : 'Welcome back'}</h2>
        <p style={S.sub}>
          {isSignup ? 'Create an account to keep the spots you heart.' : 'Sign in to heart reels and find them later.'}
        </p>
        <form onSubmit={submit}>
          <input
            style={S.input}
            type="email"
            required
            autoFocus
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={S.input}
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={S.error}>{error}</div>}
          {info && <div style={S.info}>{info}</div>}
          <button style={{ ...S.submit, opacity: busy ? 0.6 : 1 }} type="submit" disabled={busy}>
            {busy ? 'One sec…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <div style={S.switchRow}>
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <button
            style={S.switchBtn}
            onClick={() => {
              setMode(isSignup ? 'signin' : 'signup');
              setError(null);
              setInfo(null);
            }}
          >
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
