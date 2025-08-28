/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Server components configuration
  serverExternalPackages: ['@prisma/client'],
  outputFileTracingRoot: __dirname,
  
  // Image optimization
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com', 'localhost', 'vercel.app'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://soberlivings-finder.vercel.app',
  },
  
  // Experimental features for performance
  experimental: {
    // Enable server components runtime
    serverComponentsExternalPackages: ['@prisma/client'],
    
    // Enable instrumentation for monitoring
    instrumentationHook: true,
  },
  
  // Security and CORS headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ]
  },
  
  // API proxying
  async rewrites() {
    return [
      {
        source: '/api/v2/:path*',
        destination: 'https://findtreatment.gov/locator/:path*',
      },
    ];
  },
  
  // Output configuration
  output: 'standalone',
  
  // Enable build cache
  cacheMaxMemorySize: 0, // Use default
}

module.exports = nextConfig