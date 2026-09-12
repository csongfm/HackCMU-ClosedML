import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Briefly — Your Daily Audio Briefing',
  description:
    'A focused, personalized ten-minute news briefing built around what matters to you.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Grammarly injects body attributes before hydration; keep suppression scoped here. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
