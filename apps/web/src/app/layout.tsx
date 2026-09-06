import { Geist } from 'next/font/google';
import '@offert/offer/template/offerte.css';
import '@offert/offer/template/vermarktungsofferte.css';

export const metadata = { title: 'Offertsystem' };

// US-10: Auf <html> gesetzt, da die CSS-Variable auf demselben Element wie Tailwinds
// Preflight-Regel liegen muss, sonst loest sie sich nicht auf.
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-sans' });

export default function Wurzellayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
