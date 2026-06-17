/**
 * Sponsor-configuratie. Eén plek om de sponsor te wijzigen: naam, pay-off, url
 * en accentkleur. Het SponsorCard-component leest hier uit.
 */
export interface Sponsor {
  name: string
  payoff: string
  url: string
  color: string
}

export const SPONSOR: Sponsor = {
  name: 'vastelasten.app',
  payoff: 'Bespaar slim op je vaste lasten',
  url: 'https://www.vastelasten.app',
  color: '#1D9E75',
}
