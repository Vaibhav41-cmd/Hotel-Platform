import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, X } from 'lucide-react';
import { api } from './api.js';
import { loginSchema, signupSchema } from './validation.js';

const demoAccounts = {
  guest: { email: 'guest@sereinstays.demo', password: 'Welcome!2026' },
  admin: { email: 'admin@sereinstays.demo', password: 'Harbor!2026' },
};

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (event) => {
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setError('');
  };
  const fillDemo = (account) => {
    setMode('login');
    setValues((previous) => ({ ...previous, ...demoAccounts[account] }));
    setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const schema = mode === 'login' ? loginSchema : signupSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message || 'Please check your details.');
    setBusy(true);
    try {
      const session = await api(`/auth/${mode}`, { method: 'POST', body: parsed.data });
      onSuccess(session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="auth-art">
          <div className="auth-art-mark">S<span>.</span></div>
          <p>Find your softer<br />side of the city.</p>
          <small>Thoughtful stays, right where you want to be.</small>
          <div className="auth-art-caption">SEREIN&nbsp; / &nbsp;MUMBAI</div>
        </div>
        <div className="auth-content">
          <span className="eyebrow">WELCOME TO SEREIN</span>
          <h2 id="auth-title">{mode === 'login' ? 'Come on in.' : 'Make yourself at home.'}</h2>
          <p className="muted auth-subtitle">{mode === 'login' ? 'Sign in to find your next favourite stay.' : 'Create an account to make your stay yours.'}</p>
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Create account</button>
          </div>
          <form onSubmit={submit} className="stack-form">
            {mode === 'signup' && <label className="field-label">Your name<input autoComplete="name" name="name" value={values.name} onChange={change} placeholder="Aanya Mehta" required /></label>}
            <label className="field-label">Email address<span className="input-icon"><Mail size={16} /><input autoComplete="email" name="email" type="email" value={values.email} onChange={change} placeholder="you@example.com" required /></span></label>
            <label className="field-label">Password<span className="input-icon"><LockKeyhole size={16} /><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} name="password" type={showPassword ? 'text' : 'password'} value={values.password} onChange={change} placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'} required /><button type="button" className="reveal-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <button className="button button-dark full-width auth-submit" disabled={busy} type="submit">{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create my account'}<ArrowRight size={17} /></button>
          </form>
          <div className="demo-access">
            <div className="demo-divider"><span>TRY THE DEMO</span></div>
            <div className="demo-buttons">
              <button type="button" onClick={() => fillDemo('guest')}><KeyRound size={14} /> Guest view</button>
              <button type="button" onClick={() => fillDemo('admin')}><KeyRound size={14} /> Front desk</button>
            </div>
          </div>
          <p className="tiny-muted auth-privacy">By continuing, you agree to our guest terms and privacy policy.</p>
        </div>
      </section>
    </div>
  );
}
