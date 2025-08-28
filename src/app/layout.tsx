import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'SoberLiving Finder - Find Quality Treatment Facilities',
  description: 'Search thousands of verified residential treatment facilities, sober living homes, and recovery programs nationwide. Get detailed information, reviews, and contact details with AI-enhanced data.',
  keywords: [
    'sober living',
    'treatment facilities', 
    'addiction recovery',
    'residential treatment',
    'rehab centers',
    'recovery programs',
    'substance abuse treatment',
    'detox centers',
    'outpatient treatment'
  ],
  authors: [{ name: 'SoberLiving Finder Team' }],
  creator: 'SoberLiving Finder',
  openGraph: {
    title: 'SoberLiving Finder - Find Quality Treatment Facilities',
    description: 'Search thousands of verified residential treatment facilities nationwide with AI-enhanced data.',
    type: 'website',
    locale: 'en_US',
    url: 'https://soberlivings-finder.vercel.app',
    siteName: 'SoberLiving Finder',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SoberLiving Finder - Treatment Facility Search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoberLiving Finder - Find Treatment Facilities',
    description: 'Search verified treatment facilities nationwide with AI-enhanced data',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'healthcare',
  classification: 'Healthcare Directory',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SoberLiving Finder" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium transition-all duration-200 focus:ring-2 focus:ring-primary-foreground focus:ring-offset-2 focus:ring-offset-primary">
          Skip to main content
        </a>
        <div id="root" className="min-h-screen">
          <main id="main-content">
            {children}
          </main>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}