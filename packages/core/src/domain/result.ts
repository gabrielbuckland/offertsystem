// Keine Formel. Erwartbarer fachlicher Ausgang -> Result; Defekt -> Ausnahme (Spec 03 §3.5).
export type Result<T, E> =
  | { readonly ok: true; readonly wert: T }
  | { readonly ok: false; readonly fehler: E };

export function ok<T>(wert: T): Result<T, never> {
  return { ok: true, wert };
}

export function fehlschlag<E>(fehler: E): Result<never, E> {
  return { ok: false, fehler };
}
