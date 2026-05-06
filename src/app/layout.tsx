import './globals.css';
import OneSignalInitializer from '@/components/OneSignalInitializer';
import AppHeader from '@/components/AppHeader';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <OneSignalInitializer />
      </head>
      <body className="antialiased">
        <div className="min-h-screen bg-white text-slate-950">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
