import Dashboard from '@/components/Dashboard';
import { sourcePreviewRows } from '@/lib/source-preview';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'KAWT | Read-only source preview' };
export default function SourcePreviewPage() {
 return <Dashboard initialCamps={sourcePreviewRows()} role="demo" demo />;
}
