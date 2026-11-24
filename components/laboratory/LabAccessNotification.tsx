'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
export default function LabAccessNotification() {
 const [count, setCount] = useState<number | null>(null);
 useEffect(() => {
  let active = true;
  const refresh = async () => {
   try { const response = await fetch('/api/lab/access-requests/admin?summary=1', { cache: 'no-store' });if (!response.ok) throw new Error();const result = await response.json();if (active) setCount(result.pendingCount); }
   catch { if (active) setCount(null); }
  };
  void refresh();const timer = setInterval(() => void refresh(), 30000);window.addEventListener('focus', refresh);
  return () => { active = false;clearInterval(timer);window.removeEventListener('focus', refresh); };
 }, []);
 return <Link href="/lab/access" aria-label={count === null ? 'Staff access requests' : 'Staff access requests: ' + count + ' pending'} className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-900/15 px-2.5 py-2 text-xs font-semibold text-emerald-950"><Bell size={17} /><span className="hidden sm:inline">Staff requests</span>{count !== null && <span className={'rounded-full px-1.5 py-0.5 ' + (count ? 'bg-amber-100 text-amber-950' : 'bg-emerald-50 text-emerald-800')}>{count}</span>}</Link>;
}
