'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function LabLogin() {
 const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState(''), [pending, setPending] = useState(false);
 const [mode, setMode] = useState<'signin' | 'signup'>('signin'), [name, setName] = useState('');
 const router = useRouter();
 async function signIn(event: React.FormEvent) {
  event.preventDefault();setPending(true);setMessage('');
  try {
   const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, email, password, entrypoint: 'lab', ...(name.trim() ? { full_name: name.trim() } : {}) }) });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error ?? 'Email confirmation aur account access check karein');
   if (!result.authenticated) { setMessage('Apni email mein confirmation link kholein. Tasdeeq ke baad Lab access ki request administrator ko bhej sakte hain.');return; }
   router.replace(mode === 'signup' ? '/lab/access' : '/lab');router.refresh();
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in nahin ho saka'); }
  finally { setPending(false); }
 }
 return <main className="flex min-h-screen items-center justify-center px-5 py-8"><section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm"><p className="text-xs font-bold tracking-widest text-emerald-900">KHIDMAT-E-ALAM MEDICAL CENTRE</p><h1 className="my-4 font-serif text-3xl">Laboratory sign-in</h1><p className="mb-5 text-sm text-slate-600">Staff signup ke baad email confirm karein aur Lab access request bhejein. Administrator approval ke baghair department records nahin khulte.</p><div className="mb-5 flex flex-wrap gap-2"><button type="button" className={'rounded-lg border px-3 py-2 text-sm ' + (mode === 'signin' ? 'bg-emerald-900 text-white' : '')} onClick={() => { setMode('signin');setMessage(''); }}>Sign in</button><button type="button" className={'rounded-lg border px-3 py-2 text-sm ' + (mode === 'signup' ? 'bg-emerald-900 text-white' : '')} onClick={() => { setMode('signup');setMessage(''); }}>Staff account banayein</button></div><form onSubmit={signIn}>{mode === 'signup' && <label className="mb-4 block text-sm font-semibold">Full name<input aria-label="Staff full name" className="mt-2 w-full rounded-lg border p-3" autoComplete="name" minLength={2} maxLength={140} value={name} onChange={e => setName(e.target.value)} /></label>}<label className="mb-4 block text-sm font-semibold">Work email<input aria-label="Lab work email" className="mt-2 w-full rounded-lg border p-3" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="mb-5 block text-sm font-semibold">Password<input aria-label="Lab account password" className="mt-2 w-full rounded-lg border p-3" type="password" minLength={12} maxLength={200} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={pending} className="w-full rounded-lg bg-emerald-900 p-3 font-semibold text-white">{pending ? 'Please wait…' : mode === 'signup' ? 'Staff account create karein' : 'Lab kholein'}</button>{message && <p role="status" className="mt-4 text-sm">{message}</p>}</form><a className="mt-5 block text-sm underline" href="/login">Overall staff / donor sign-in</a></section></main>;
}
