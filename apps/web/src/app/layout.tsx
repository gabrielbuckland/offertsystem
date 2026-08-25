import { Geist } from 'next/font/google';
import '@offert/offer/src/template/offerte.css';

export const metadata = { title: 'Offertsystem' };

// Auf <html> gesetzt (nicht nur in (anwendung)): die CSS-Variable muss auf demselben
// Element liegen, das Tailwinds Preflight-Regel `html { font-family: var(--font-sans) }`
// referenziert, sonst loest sie sich fuer dieses Element nicht auf. Die Offerte-Route
// bleibt trotzdem unberuehrt, da `.offerte` in offerte.css ihre eigene Schriftart
// explizit setzt (US-10).
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-sans' });

export default function Wurzellayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
