import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

interface WebpackKonfiguration {
  resolve: { extensionAlias?: Record<string, string[]> };
}

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@offert/core', '@offert/offer', '@offert/pricehubble'],
  // fileURLToPath statt .pathname: Ablageort enthaelt Leerzeichen (URL-kodiert, sonst nicht aufloesbar).
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Next schreibt in die ihm zugewiesene tsconfig; deshalb separat von tsconfig.next.json.
  typescript: { tsconfigPath: './tsconfig.next.json' },
  experimental: { typedRoutes: true },
  // PE-14: transpilePackages verlangt .js-Endung in relativen Importen; Webpack loest das nicht selbst auf.
  webpack: (konfiguration: WebpackKonfiguration) => {
    konfiguration.resolve.extensionAlias = {
      ...konfiguration.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return konfiguration;
  },
};

export default config;
