import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'animate.css/animate.min.css';
import './globals.css';
import type { Metadata } from 'next';
import ClientLayout from '../components/ClientLayout';
import { AuthProvider } from '../contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Smart School System',
  description: 'A PERN Stack Application',
  applicationName: 'Smart School System',
  manifest: '/manifest.json',
  themeColor: '#0b3a53',
  icons: {
    icon: '/icons/app-icon.svg',
    apple: '/icons/app-icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Smart School System',
    statusBarStyle: 'default',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
