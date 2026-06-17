/**
 * Sponsor-configuratie. Eén plek om de sponsor te wijzigen of vervangen:
 * logo, label, merknaam, pay-off, call-to-action, url en accentkleur.
 * Het SponsorCard-component leest hier alles uit.
 */
export interface Sponsor {
  /** Pad naar het logo in /public (vaste verhouding, vierkante badge). */
  logo: string
  /** Klein label boven de merknaam. */
  label: string
  /** Merknaam, duidelijk leesbaar. */
  name: string
  /** Korte pay-off. */
  payoff: string
  /** Call-to-action-tekst (zonder pijl; die zetten we zelf). */
  cta: string
  /** Doel-url (opent in nieuw tabblad). */
  url: string
  /** Accentkleur uit het logo (goud), voor fallback/details. */
  color: string
}

export const SPONSOR: Sponsor = {
  logo: '/vastelasten-logo.svg',
  label: 'Mogelijk gemaakt door',
  name: 'vastelasten.app',
  payoff: 'De markt verbergt wat jij betaalt. Wij laten het zien.',
  cta: 'Ontdek vastelasten.app',
  url: 'https://www.vastelasten.app',
  color: '#A8842B',
}
