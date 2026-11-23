'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function LabLogin() {
 const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState(''), [pending, setPending] = useState(false);
 const router = useRouter();
 async function signIn(event: React.FormEvent) {
  event.preventDefault();setPending(true);setMessage('');
  try {
   const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signin', email, password }) });
   const result = await response.json();
   if (!response.ok || !result.authenticated) throw new Error(result.error ?? 'Email confirmation aur account access check karein');
   router.replace('/lab');router.refresh();
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in nahin ho saka'); }
  finally { setPending(false); }
 }
 return <main className="flex min-h-screen items-center justify-center px-5"><form onSubmit={signIn} className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm"><p className="text-xs font-bold tracking-widest text-emerald-900">KHIDMAT-E-ALAM MEDICAL CENTRE</p><h1 className="my-4 font-serif text-3xl">Laboratory sign-in</h1><p className="mb-6 text-sm text-slate-600">Apne assigned account se lab entry aur reports kholein.</p><label className="mb-4 block text-sm font-semibold">Work email<input className="mt-2 w-full rounded-lg border p-3" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="mb-5 block text-sm font-semibold">Password<input className="mt-2 w-full rounded-lg border p-3" type="password" minLength={12} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={pending} className="w-full rounded-lg bg-emerald-900 p-3 font-semibold text-white">{pending ? 'Sign-in ho raha hai…' : 'Lab kholein'}</button>{message && <p role="alert" className="mt-4 text-sm text-red-800">{message}</p>}</form></main>;
}
