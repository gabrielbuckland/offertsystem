import { redirect } from 'next/navigation';

// Der Sieben-Schritt-Assistent und das Dashboard entfallen (Design-Spec §3/§8): die
// Projektuebersicht ist die einzige Einstiegsseite.
export default function Startseite() {
  redirect('/projekte');
}
