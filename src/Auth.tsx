import { useState } from 'react';
import { CheckCircle2, DraftingCompass, Globe2, Layers3, LockKeyhole } from 'lucide-react';
import { useApp } from './context';
import { Building } from './components';
import { Field } from './forms';
import { appUrl, configured, supabase } from './supabase';

export function Auth() {
  const { t, lang, setLang, studio, run, busy } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [message, setMessage] = useState('');
  const recovery = studio.recovery && studio.session;
  return <div className="auth-page"><section className="auth-story"><div className="brand auth-brand"><span className="brand-symbol"><DraftingCompass size={23}/></span><span>architect<span className="brand-light">studio</span></span></div><div className="auth-story-content"><h1>{t('A considered space for your studio.')}</h1><p>{t('From the first sketch to the final handover. Keep your projects, people, and next steps in one place.')}</p><Building variant={0} eager/><div className="auth-features"><span><Layers3 size={18}/>{t('Projects')}</span><span><CheckCircle2 size={18}/>{t('Tasks')}</span><span><Globe2 size={18}/>{t('Team')}</span></div></div></section><section className="auth-main"><button className="language-button" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><Globe2 size={16}/>{lang === 'en' ? 'العربية' : 'English'}</button><div className="auth-form-wrap"><div className="auth-icon"><LockKeyhole size={23}/></div><h2>{t(!configured ? 'Connect your studio' : recovery ? 'Set new password' : mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password')}</h2><p>{t(!configured ? 'This app is ready for GitHub Pages. Connect a Supabase project to enable accounts and shared data.' : 'Sign in to your studio workspace.')}</p>
    {!configured ? <div className="setup-instructions"><p className="notice">{t('Connection not configured')}</p><p>{t('Read README.md for database and hosting setup.')}</p><code>VITE_SUPABASE_URL<br/>VITE_SUPABASE_PUBLISHABLE_KEY</code><button className="button primary full-width" onClick={studio.enterDemo}>{t('Try the demo')}</button></div> : <><form className="auth-form" onSubmit={e => { e.preventDefault(); setMessage(''); void run(async () => {
      if (recovery) { const { error } = await supabase!.auth.updateUser({ password }); if (error) throw error; studio.setRecovery(false); history.replaceState(null, '', `${appUrl()}#/overview`); setMessage('Password updated.'); return; }
      if (mode === 'signup') { const { error } = await supabase!.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: appUrl() } }); if (error) throw error; setMessage('Check your email to confirm your account, then sign in.'); }
      else if (mode === 'reset') { const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}?flow=recovery` }); if (error) throw error; setMessage('Check your email for a password reset link.'); }
      else { const { error } = await supabase!.auth.signInWithPassword({ email, password }); if (error) throw error; }
    }); }}>
      {mode === 'signup' && !recovery && <Field label="Your name"><input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)}/></Field>}
      {!recovery && <Field label="Email address"><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></Field>}
      {(mode !== 'reset' || recovery) && <Field label="Password"><input required type="password" minLength={8} autoComplete={mode === 'signin' && !recovery ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)}/>{(mode === 'signup' || recovery) && <small>{t('Use at least 8 characters.')}</small>}</Field>}
      {mode === 'signin' && !recovery && <button type="button" className="text-button forgot-password" onClick={() => setMode('reset')}>{t('Forgot password?')}</button>}
      <button className="button primary full-width" disabled={busy}>{t(busy ? 'Saving…' : recovery ? 'Update password' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset email')}</button>
    </form>{message && <p className="success-message" role="status">{t(message)}</p>}{!recovery && <div className="auth-secondary"><button className="text-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>{t(mode === 'signin' ? 'Create account' : 'Back to sign in')}</button><span>·</span><button className="text-button" onClick={studio.enterDemo}>{t('Try the demo')}</button></div>}</>}
    </div></section></div>;
}

export function Onboarding({ token }: { token: string | null }) {
  const { studio, t, run, busy, navigate } = useApp(); const [name, setName] = useState('');
  return <div className="onboarding"><span className="brand-symbol"><DraftingCompass size={25}/></span><h1>{t(token ? 'Join your studio' : 'Create your studio')}</h1><p>{t(token ? 'Sign in with the email address this invitation was sent to.' : 'Give your team a shared home.')}</p>{token ? <button disabled={busy} className="button primary" onClick={() => void run(async () => { await studio.rpc('accept_invitation', { invitation_token: token }); sessionStorage.removeItem('studio-invitation'); navigate('/overview'); }, 'Changes saved')}>{t('Accept invitation')}</button> : <form onSubmit={e => { e.preventDefault(); void run(() => studio.rpc('create_studio', { studio_name: name.trim() }), 'Changes saved'); }}><Field label="Studio name"><input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></Field><button disabled={busy || !name.trim()} className="button primary full-width">{t('Create studio')}</button><p className="muted">{t('Have an invitation? Open the link your studio owner shared with you.')}</p></form>}<button className="text-button" onClick={() => void run(studio.signOut)}>{t('Sign out')}</button></div>;
}
