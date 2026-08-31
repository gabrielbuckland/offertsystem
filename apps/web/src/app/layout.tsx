import { Geist } from 'next/font/google';
import '@offert/offer/template/offerte.css';
import '@offert/offer/template/vermarktungsofferte.css';

export const metadata = { title: 'Offertsystem' };

// Auf <html> gesetzt: die CSS-Variable muss auf demselben Element liegen wie Tailwinds
// Preflight-Regel `html { font-family: var(--font-sans) }`, sonst loest sie sich nicht
// auf. `.offerte` setzt ihre Schriftart trotzdem explizit selbst (US-10).
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-sans' });

export default function Wurzellayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
