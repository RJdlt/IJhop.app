import { SPONSOR } from '../lib/sponsor'

/** Korte, leesbare privacyverklaring op /privacy. */
export function Privacy() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <a href="/" className="text-sm font-medium text-brand">← Terug naar IJhop</a>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Privacy</h1>
        <p className="mt-1 text-sm text-slate-500">Kort en duidelijk. Laatst bijgewerkt: juni 2026.</p>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="font-bold text-slate-900">Wat we verzamelen</h2>
            <p className="mt-1">
              IJhop werkt grotendeels zonder je gegevens. Voor het spel bewaren we anonieme,
              niet-herleidbare gebruiksstatistieken (zoals hoeveel mensen spelen) om de app te
              verbeteren. Daar zit geen naam, e-mail of locatie bij.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-slate-900">E-mail voor de prijzenactie</h2>
            <p className="mt-1">
              Alleen als je dat zelf kiest en het vinkje aanzet, bewaren we je e-mailadres samen met
              je score, zodat we je kunnen benaderen voor een actie (bijvoorbeeld een prijs bij een
              NDSM-restaurant). Zonder vinkje slaan we niets op.
            </p>
            <p className="mt-1">
              Je e-mailadres wordt niet verkocht of gedeeld met derden voor reclame. Je kunt ons
              altijd vragen je gegevens te verwijderen.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-slate-900">Bewaren en intrekken</h2>
            <p className="mt-1">
              We bewaren inzendingen niet langer dan nodig voor de actie. Wil je je gegevens laten
              verwijderen of je toestemming intrekken? Laat het ons weten en we regelen het.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-slate-900">Sponsor</h2>
            <p className="mt-1">
              IJhop wordt mede mogelijk gemaakt door{' '}
              <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">
                {SPONSOR.name}
              </a>
              . Als je hun site bezoekt, gelden hun eigen voorwaarden en privacybeleid.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
