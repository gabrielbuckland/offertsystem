import './globals.css';
import '@offert/offer/src/template/offerte.css';

export const metadata = { title: 'Offertsystem' };

export default function Wurzellayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body>{children}</body>
    </html>
  );
}
