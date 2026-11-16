import './globals.css';
import type { Metadata } from 'next';
import { PwaRegistration } from '@/components/PwaRegistration';
export const metadata: Metadata = { title: 'KAWT | Camp Operations & Growth', description:'Khidmat-e-Alam Welfare Trust — medical camp management, financial stewardship and donor impact' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}<PwaRegistration/></body></html>}
