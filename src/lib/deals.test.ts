import { describe, expect, it } from 'vitest'
import { formatDealCountdown, isLive, secondsUntil, shouldOfferTip, SOCIAL_PROOF_MIN } from './deals'
import { dealWeekWindow } from './time'

const week = dealWeekWindow('2026-09-07')!
const deal = { valid_from: week.from, valid_to: week.to }

describe('geldigheidsvenster', () => {
  it('is dicht op zondagavond', () => {
    expect(isLive(deal, new Date('2026-09-06T20:00:00Z'))).toBe(false)
  })

  it('gaat maandag om middernacht Amsterdamse tijd open', () => {
    // 21:59 UTC op zondag is nog zondag hier; 22:00 UTC is maandag 00:00.
    expect(isLive(deal, new Date('2026-09-06T21:59:00Z'))).toBe(false)
    expect(isLive(deal, new Date('2026-09-06T22:00:00Z'))).toBe(true)
  })

  it('loopt dinsdag gewoon door', () => {
    expect(isLive(deal, new Date('2026-09-08T12:00:00Z'))).toBe(true)
  })

  it('sluit na woensdag 23:59:59', () => {
    expect(isLive(deal, new Date('2026-09-09T21:59:59Z'))).toBe(true)
    expect(isLive(deal, new Date('2026-09-09T22:00:00Z'))).toBe(false)
  })

  it('is dicht bij onzin-data', () => {
    expect(isLive({ valid_from: 'kaas', valid_to: 'worst' })).toBe(false)
  })
})

describe('afteller', () => {
  it('telt nooit terug tot onder nul', () => {
    expect(secondsUntil(week.to, new Date('2026-09-20T00:00:00Z'))).toBe(0)
  })

  it('telt in dagen, dan uren, dan minuten', () => {
    expect(formatDealCountdown(2 * 86400 + 3600)).toBe('nog 2 dagen')
    expect(formatDealCountdown(86400)).toBe('nog 1 dag')
    expect(formatDealCountdown(5 * 3600)).toBe('nog 5 uur')
    expect(formatDealCountdown(3600)).toBe('nog 1 uur')
    expect(formatDealCountdown(42 * 60)).toBe('nog 42 min')
    expect(formatDealCountdown(20)).toBe('loopt af')
  })

  it('spreekt ook Engels', () => {
    expect(formatDealCountdown(2 * 86400, 'en')).toBe('2 days left')
    expect(formatDealCountdown(3600, 'en')).toBe('1 hour left')
  })
})

describe('sociale bevestiging', () => {
  it('begint pas bij tien, anders is het een leeg podium', () => {
    expect(SOCIAL_PROOF_MIN).toBe(10)
  })
})

describe('tip een vriend', () => {
  const ingewisseld = '2026-09-08T18:00:00Z'

  it('vraagt niets op de dag zelf', () => {
    expect(shouldOfferTip(ingewisseld, false, new Date('2026-09-08T21:00:00Z'))).toBe(false)
  })

  it('vraagt het de dag erna', () => {
    expect(shouldOfferTip(ingewisseld, false, new Date('2026-09-09T09:00:00Z'))).toBe(true)
  })

  it('kijkt naar de Amsterdamse dag en niet naar UTC', () => {
    // 22:30 UTC op 8 september is hier al 9 september, dus de dag is om.
    expect(shouldOfferTip(ingewisseld, false, new Date('2026-09-08T22:30:00Z'))).toBe(true)
  })

  it('vraagt het maar één keer', () => {
    expect(shouldOfferTip(ingewisseld, true, new Date('2026-09-09T09:00:00Z'))).toBe(false)
  })

  it('vraagt niets zonder inwisseling', () => {
    expect(shouldOfferTip(null, false, new Date('2026-09-09T09:00:00Z'))).toBe(false)
  })
})
