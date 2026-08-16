import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/**
 * Next reicht die Webpack-Konfiguration als `any` herein; hier steht der Ausschnitt,
 * der tatsaechlich angefasst wird. Eine vollstaendige Webpack-Typdeklaration waere eine
 * zusaetzliche Abhaengigkeit fuer eine einzige Eigenschaft.
 */
interface WebpackKonfiguration {
  resolve: { extensionAlias?: Record<string, string[]> };
}

/**
 * Bewusst minimal. Die Offert-Vorlage liegt als TypeScript-Quelle in @offert/offer und
 * wird nicht vorab uebersetzt; deshalb wird das Paket transpiliert. Ein Build-Schritt
 * je Paket wuerde eine zweite Artefaktstufe einfuehren, ohne dem Nachweis zu dienen.
 */
const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@offert/core', '@offert/offer', '@offert/pricehubble'],
  // `fileURLToPath` statt `.pathname`: Der Ablageort enthaelt Leerzeichen, die in einer
  // file-URL prozentkodiert sind und als Pfad nicht mehr aufloesbar waeren.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Next schreibt in die ihm zugewiesene tsconfig hinein; sie ist deshalb von der
  // Projektverweis-Konfiguration getrennt (siehe apps/web/tsconfig.next.json).
  typescript: { tsconfigPath: './tsconfig.next.json' },
  experimental: { typedRoutes: true },
  /**
   * Die Workspace-Pakete werden als TypeScript-Quelle eingebunden (transpilePackages) und
   * fuehren nach PE-14 die verbindliche `.js`-Endung in relativen Importen. Webpack loest
   * diese Endung nicht von selbst auf die Quelldatei auf; `extensionAlias` stellt genau
   * diese Zuordnung her. Die Alternative — ein Build-Schritt je Paket — waere eine zweite
   * Artefaktstufe ohne Nutzen fuer den Nachweis.
   */
  webpack: (konfiguration: WebpackKonfiguration) => {
    konfiguration.resolve.extensionAlias = {
      ...konfiguration.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return konfiguration;
  },
};

export default config;
