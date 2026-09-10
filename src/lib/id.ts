/** Willekeurig id, ook als crypto.randomUUID ontbreekt (oudere Safari, niet-
 *  beveiligde context). Faalt nooit, want hierop hangen sessie- en
 *  bezoekerstellingen. Staat apart zodat analytics en profiel het allebei
 *  kunnen gebruiken zonder kringverwijzing. */
export function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* val door naar de eenvoudige variant */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
