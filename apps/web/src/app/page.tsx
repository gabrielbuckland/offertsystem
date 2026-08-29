import { redirect } from 'next/navigation';

// Projektuebersicht ist die einzige Einstiegsseite (Design-Spec §3/§8).
export default function Startseite() {
  redirect('/projekte');
}
