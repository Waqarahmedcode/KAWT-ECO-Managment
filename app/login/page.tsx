'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { api,control,primary,secondary } from '@/components/workspace/Controls';
import { supabasePublicKey } from '@/lib/supabase-config';
export default function Login(){
 const [email,setEmail]=useState('');const [message,setMessage]=useState('');const [pending,setPending]=useState(false);
 const [password,setPassword]=useState(''),[mode,setMode]=useState<'magic'|'password'|'signup'>('password');
 const router=useRouter();
 async function signin(e:React.FormEvent){e.preventDefault();setPending(true);
  if(mode!=='magic'){
   try{const result=await api('/api/auth/session',{action:mode==='signup'?'signup':'signin',email,password});if(result.authenticated){router.push('/dashboard');router.refresh()}else setMessage('Check your email to confirm your account. New accounts have donor access; an administrator assigns staff roles.')}catch(error){setMessage(error instanceof Error?error.message:'Unable to sign in')}finally{setPending(false)}
   return;
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=supabasePublicKey();
  if(!url||!key){setMessage('Configure Supabase to sign in.');setPending(false);return}
  const client=createBrowserClient(url,key);const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=/dashboard`}});
  setMessage(error?.message??'Check your email for a sign-in link.');setPending(false)
 }
 return <main className="min-h-screen flex items-center justify-center px-5"><div className="bg-white p-9 rounded-2xl shadow-soft max-w-md w-full"><p className="text-emerald-950 tracking-[.22em] text-xs uppercase font-bold">Khidmat-e-Alam Welfare Trust</p><h1 className="font-serif text-3xl my-3">Staff & donor access</h1><p className="text-sm text-slate-500 mb-5">Sign in to your workspace. Clinical and financial access depends on your assigned role.</p><div className="mb-5 flex flex-wrap gap-2">{(['password','magic','signup'] as const).map(option=><button key={option} onClick={()=>{setMode(option);setMessage('')}} className={mode===option?primary:secondary}>{option==='magic'?'Email link':option==='signup'?'Donor sign-up':'Password'}</button>)}</div><form onSubmit={signin} className="space-y-4"><label className="block text-sm font-semibold">Work email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className={`${control} mt-2`} autoComplete="email" placeholder="name@example.org"/></label>{mode!=='magic'&&<label className="block text-sm font-semibold">Password<input required type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} className={`${control} mt-2`} autoComplete={mode==='signup'?'new-password':'current-password'}/></label>}<button className={`${primary} w-full`} disabled={pending}>{pending?'Please wait…':mode==='magic'?'Send secure sign-in link':mode==='signup'?'Create donor account':'Sign in'}</button></form>{message&&<p role="status" className="mt-4 text-sm">{message}</p>}<a className="block mt-5 text-sm text-emerald-950 underline" href="/donate">Public donor portal</a></div></main>
}
