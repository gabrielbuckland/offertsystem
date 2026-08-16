import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

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
  experimental: { typedRoutes: true },
};

export default config;
