import { notFound } from 'next/navigation';
import { baueFaktorformular } from '../../../../server/faktorformular.js';
import { holeLaufzeit } from '../../../../server/laufzeit.js';
import { ladeProjekt } from '../../../../server/projekt-ablage.js';
import { ProjektAnsicht } from '../../../../components/projekt/ProjektAnsicht.js';

export const dynamic = 'force-dynamic';

interface Props { readonly params: Promise<{ readonly id: string }> }

export default async function ProjektSeite({ params }: Props) {
  const { id } = await params;
  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Projekt</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }
  const projekt = await ladeProjekt(id, laufzeit.wert.projekteVerzeichnis).catch(() => null);
  if (projekt === null) notFound();
  const { konfiguration } = laufzeit.wert;
  return (
    <ProjektAnsicht
      projekt={projekt}
      faktorformular={baueFaktorformular(konfiguration)}
    />
  );
}
