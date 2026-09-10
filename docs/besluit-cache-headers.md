# Cache-afspraken (vercel.json)

JSON kent geen commentaar en Vercel keurt onbekende sleutels in `vercel.json`
af, dus de uitleg staat hier in plaats van in het bestand zelf.

| Wat | Header | Waarom |
| --- | --- | --- |
| `/` en `/index.html` | `public, max-age=0, must-revalidate` | De schil is de deur waarlangs een nieuwe versie binnenkomt. Blijft die hangen, dan blijft de bezoeker op oud draaien zonder dat iets dat kan merken. |
| `sw.js`, `registerSW.js`, `push-sw.js`, `manifest.json` | `public, max-age=0, must-revalidate` | Idem: de browser moet de service worker altijd echt ophalen, anders vindt `registration.update()` nooit iets nieuws. |
| `/assets/*` | `public, max-age=31536000, immutable` | Deze bestanden dragen een inhoudshash in hun naam. Wijzigt de inhoud, dan wijzigt de URL, dus ze mogen onbeperkt blijven staan. |

De dienstregeling zit als JSON in het gehashte bundeltje onder `/assets/`, niet
als los bestand. Ze verhuist dus samen met de schil naar een nieuwe versie en
kan niet apart verouderen.

De opdracht was: schil en dienstregeling niet langer dan 24 uur cachen. Met
`max-age=0, must-revalidate` op de schil is dat nul seconden aan de netwerkkant.
Wat daarna nog cachet is de precache van de service worker. Die van de nieuwe
versie wordt meteen aangelegd, en de bezoeker stapt erop over zodra hij op
"Vernieuwen" tikt of de app opnieuw opent. Hoe snel hij dat te zien
krijgt staat in `src/pwa.ts`: bij het openen, bij terugkeer naar de voorgrond,
elk kwartier, en met een vangnet van 24 uur (`MAX_STALE_MS`).

**Let op bij het bewerken van `vercel.json`:** geen extra sleutels toevoegen,
ook geen `comment`. Vercel valideert het bestand tegen zijn schema en laat de
build mislukken op een sleutel die het niet kent.

## Waarom skipWaiting aan staat en clientsClaim uit

Eerst stonden ze allebei uit, want een worker die netjes wacht klinkt als de
voorzichtige keuze. Dat is het niet. Een wachtende worker wordt pas actief als
alle vensters van de app dicht zijn geweest, en een geïnstalleerde PWA op een
telefoon gaat soms weken niet dicht.

Uitgeprobeerd met twee echte builds: een bestaande installatie kreeg de balk
te zien, tikte op "Vernieuwen", en stond daarna nog steeds op de oude versie.
Een gewone herlaad maakt een wachtende worker namelijk niet actief. Pas na de
app helemaal afsluiten kwam de nieuwe versie binnen.

Nu wordt de nieuwe worker meteen actief (`skipWaiting`), maar neemt hij geen
open pagina's over (`clientsClaim` uit). De lopende pagina houdt dus zijn eigen
bestanden tot de bezoeker zelf herlaadt: er wisselt niets onder een lopende
aftelling vandaan, en één tik is genoeg.
