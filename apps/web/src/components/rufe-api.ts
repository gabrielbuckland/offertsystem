import { leseRumpf } from './projekt/antwort-rumpf.js';

export interface ApiErgebnis<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly rumpf: T;
}

// Einziger fetch-Weg der Oberflaeche (Spec §3): buendelt fetch + leseRumpf + Fangnetz.
// JSON-Koerper setzen Aufrufer weiterhin selbst via `init`, damit der Wrapper keine zweite
// Serialisierungsregel wird.
export async function rufeApi<T>(pfad: string, init?: RequestInit): Promise<ApiErgebnis<T>> {
  try {
    const antwort = await fetch(pfad, init);
    return { ok: antwort.ok, status: antwort.status, rumpf: await leseRumpf<T>(antwort) };
  } catch {
    return { ok: false, status: 0, rumpf: {} as T };
  }
}
