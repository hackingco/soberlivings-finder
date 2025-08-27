import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SoberLiving Finder - Find Treatment Facilities',
  description: 'Search thousands of residential treatment facilities, sober living homes, and recovery programs nationwide. Get detailed information, reviews, and contact details.',
  keywords: 'sober living, treatment facilities, addiction recovery, residential treatment, rehab centers',
  authors: [{ name: 'SoberLiving Finder' }],
  openGraph: {
    title: 'SoberLiving Finder - Find Treatment Facilities',
    description: 'Search thousands of residential treatment facilities nationwide',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoberLiving Finder',
    description: 'Find residential treatment facilities nationwide',
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  )
}