/** Keine Formel. Strukturierte Protokollereignisse mit Maskierung (Spec 04 §6.7, AK-18). */
export interface VersuchEreignis {
  readonly ts: string;
  readonly endpoint: string;
  readonly method: string;
  readonly attempt: number;
  readonly httpStatus?: number;
  readonly elapsedMs: number;
  readonly phRequestId?: string;
  readonly outcome: 'ok' | 'wiederholung' | 'aufgegeben';
}

export interface VertragsbruchEreignis {
  readonly ts: string;
  readonly endpoint: string;
  readonly pfad: string;
  readonly erwarteterTyp: string;
}

export interface AbbruchEreignis {
  readonly ts: string;
  readonly vollstaendig: false;
  readonly bezogeneTypen: number;
  readonly fehlerart: string;
}

export interface Protokoll {
  versuch(ereignis: VersuchEreignis): void;
  vertragsbruch(ereignis: VertragsbruchEreignis): void;
  abbruch(ereignis: AbbruchEreignis): void;
}

const GEHEIME_KOPFZEILEN = new Set(['authorization', 'cookie', 'set-cookie']);

/** Spec 04 §2 Regel 3 und §6.7: kein Token, kein Passwort, keine E-Mail im Protokoll. */
export function maskiereKopfzeilen(
  kopfzeilen: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(kopfzeilen).map(([name, wert]) =>
      GEHEIME_KOPFZEILEN.has(name.toLowerCase()) ? [name, '***'] : [name, wert],
    ),
  );
}

/** Strukturierte JSON-Zeilen auf stdout; keine Log-Bibliothek als Abhaengigkeit. */
export const stdoutProtokoll: Protokoll = {
  versuch: (e) => process.stdout.write(`${JSON.stringify({ art: 'versuch', ...e })}\n`),
  vertragsbruch: (e) =>
    process.stdout.write(`${JSON.stringify({ art: 'vertragsbruch', ...e })}\n`),
  abbruch: (e) => process.stdout.write(`${JSON.stringify({ art: 'abbruch', ...e })}\n`),
};

export interface SammelndesProtokoll extends Protokoll {
  readonly ereignisse: ReadonlyArray<Record<string, unknown>>;
}

/** Testdoppel: dieselbe Ereignisstruktur, in einem Feld gesammelt statt geschrieben. */
export function sammelndesProtokoll(): SammelndesProtokoll {
  const ereignisse: Record<string, unknown>[] = [];
  return {
    ereignisse,
    versuch: (e) => ereignisse.push({ art: 'versuch', ...e }),
    vertragsbruch: (e) => ereignisse.push({ art: 'vertragsbruch', ...e }),
    abbruch: (e) => ereignisse.push({ art: 'abbruch', ...e }),
  };
}
