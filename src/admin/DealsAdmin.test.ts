import { describe, expect, it } from 'vitest'
import { linesForStop } from './DealsAdmin'
import { LINES, LINE_IDS } from '../lib/schedule'

describe('linesForStop', () => {
  it('geeft precies de lijnen die daar aanleggen', () => {
    for (const stop of new Set(LINE_IDS.flatMap((l) => LINES[l].connects))) {
      for (const lijn of linesForStop(stop)) {
        expect(LINES[lijn].connects).toContain(stop)
      }
    }
  })

  it('slaat een onbekende steiger over in plaats van alles te tonen', () => {
    expect(linesForStop('bestaat-niet')).toEqual([])
  })

  it('vindt voor elke lijn zijn eigen twee steigers terug', () => {
    for (const lijn of LINE_IDS) {
      for (const stop of LINES[lijn].connects) {
        expect(linesForStop(stop)).toContain(lijn)
      }
    }
  })
})
