import qrcode from 'qrcode-generator'

/**
 * QR-code als SVG-pad. Geen plaatje en geen netwerk: de code moet ook aan een
 * kassa zonder bereik op het scherm staan.
 *
 * Foutcorrectie M: genoeg marge voor een telefooncamera die schuin op een
 * scherm met vingerafdrukken kijkt, zonder dat het blokje te fijn wordt.
 */
export interface QrPath {
  /** `d`-attribuut voor een <path>. */
  path: string
  /** Aantal modules in de breedte; gebruik als viewBox "0 0 size size". */
  size: number
}

export function qrPath(text: string): QrPath {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    }
  }
  return { path: d, size: n }
}
