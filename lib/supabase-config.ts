/** Public browser-safe key only. Server secrets must never be used here.
 * Keep direct environment references so Next.js can inline browser values. */
export function supabasePublicKey(){
 return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
