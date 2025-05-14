/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add output configuration for Docker deployment
  output: 'standalone',
  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable type checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configure which routes should not be static
  experimental: {
    serverComponentsExternalPackages: ['@opentelemetry/api'],
  },
};

// Export for Next.js
export default nextConfig;
