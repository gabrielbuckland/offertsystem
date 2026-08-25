import { notFound } from 'next/navigation';
import { EinstellungsEditor } from '../../../../components/einstellungen/EinstellungsEditor.js';
import { Brotkrume } from '../../../../components/shell/Brotkrume.js';
import { holeLaufzeit } from '../../../../server/laufzeit.js';
import { BEREICHE, istGueltigerBereich } from '../bereiche.js';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ readonly bereich: string }>;
}

export default async function BereichSeite({ params }: Props) {
  const { bereich } = await params;
  if (!istGueltigerBereich(bereich)) notFound();

  const laufzeit = holeLaufzeit();
  if (!laufzeit.ok) {
    return <main><h1>Einstellungen</h1><p>{laufzeit.meldungen.join(' ')}</p></main>;
  }

  const eintrag = BEREICHE[bereich];
  return (
    <main>
      <Brotkrume stufen={[
        { beschriftung: 'Einstellungen', href: '/einstellungen' },
        { beschriftung: eintrag.titel },
      ]}
      />
      <EinstellungsEditor
        titel={eintrag.titel}
        zweck={eintrag.zweck}
        bereichPraefix={eintrag.praefix}
        anfang={laufzeit.wert.rohKonfiguration}
        Editor={eintrag.Editor}
      />
    </main>
  );
}
