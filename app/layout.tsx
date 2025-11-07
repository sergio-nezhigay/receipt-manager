import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import { CompanyProvider } from '@/contexts/CompanyContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Система управління платежами',
  description: 'Багатокомпанійна система управління платежами та чеками',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <CompanyProvider>
              {children}
            </CompanyProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
