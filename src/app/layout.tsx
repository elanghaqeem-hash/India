import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'ICOP CyberBusiness 360 — Enterprise Cybersecurity Operating System',
  description: 'Integrated CRM, Tender Intelligence, Scoping Assessment, Dynamic Pricing, DoA Approval, Proposal Generation & Project Delivery.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
