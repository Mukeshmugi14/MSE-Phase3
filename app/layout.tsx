import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI-MSE — Intelligent Mental Status Examination',
  description: 'AI-assisted psychiatric assessment platform for clinicians',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream-100 text-navy-900 font-body antialiased">
        {children}
      </body>
    </html>
  )
}
