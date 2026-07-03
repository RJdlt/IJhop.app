# Besluit: bron voor pontstoringen en vertragingen

Datum: 3 juli 2026. Status: gekozen en gebouwd (Fase 1).

## Onderzochte bronnen

### 1. OVapi KV7/KV15 JSON (v0.ovapi.nl)
- Live getest: onbereikbaar over HTTPS (verbinding faalt), historisch alleen HTTP.
- Een PWA op https mag geen http-bronnen laden (mixed content) en de dienst
  stuurt geen CORS-headers.
- Oordeel: onbruikbaar vanuit de browser, wankel als serverbron. Afgewezen.

### 2. GTFS-Realtime service alerts via NDOV/OVapi (gtfs.ovapi.nl/nl/alerts.pb)
- Live getest op 3 juli 2026: HTTP 200, ~650 KB protobuf, last-modified liep
  seconden achter op de klok (continu ververst).
- Bevat aantoonbaar GVB-berichten: 24 actieve alerts met id's als
  `KV15:GVB:2026-06-30:1092`. Dit is hetzelfde KV15-kanaal waarmee GVB ook
  veerstoringen publiceert (dezelfde berichten als op de haltedisplays).
- Alerts refereren `informed_entity` met numerieke GTFS `route_id` en `stop_id`.
  Onze eigen `timetable.json` (uit dezelfde GTFS-bron gegenereerd) bevat de
  GTFS-stop-id's van alle tien veersteigers. Match op steiger-stop-id is
  daarmee robuust en onafhankelijk van route-id-wijzigingen bij herpublicatie.
- Kanttekening (eerlijkheid): op de testdag was er geen actieve veerstoring,
  dus de keten is geverifieerd met tram/bus-alerts van GVB. De structuur is
  identiek; zodra de eerste echte veerstoring langskomt bewijst de banner
  zich in productie. Als vangnet matchen we ook op de woorden "pont" of
  "veer" in de berichttekst.
- Geen CORS-headers, dus niet direct vanuit de browser te halen.
- Oordeel: gekozen als officiele bron, ontsloten via een kleine serverless
  functie.

### 3. GVB-storingspagina (gvb.nl)
- Scraping van een consumentenpagina is fragiel (breekt bij elke redesign),
  juridisch grijs en alsnog CORS-geblokkeerd client-side. Afgewezen.

## Architectuur

```
gtfs.ovapi.nl/nl/alerts.pb  ->  /api/storingen (Vercel serverless)  ->  app
     (protobuf, ~650 KB)          decodeert, filtert op veersteigers,      (JSON, ~1 KB)
                                  cachet 120 s op de edge
```

- De functie cachet met `s-maxage=120, stale-while-revalidate=600`. De bron
  wordt daardoor wereldwijd hooguit ~30 keer per uur geraakt, ruim binnen de
  fair-use van OVapi (die vragen om niet vaker dan elke 60 s te pollen).
- De app pollt `/api/storingen` bij openen en daarna elke 5 minuten, parallel
  aan de aftelklok. De klok wacht nooit op storingsdata.
- Faalt de bron, dan antwoordt de functie `{ alerts: [] }` met een korte
  cache. De app toont dan gewoon geen banner: geen storing verzinnen, geen
  foutmelding op het hoofdscherm.

## Tweede bron: community-meldingen (1c)

Officiele berichten lopen soms achter op de werkelijkheid op de steiger.
Daarom ernaast een anonieme eenmalige "Vertraagd?"-melding per gebruiker per
lijn per 20 minuten (server-side afgedwongen, migratie 0013). De banner toont
pas iets vanaf 2 meldingen binnen 20 minuten om ruis te onderdrukken.
Meldingen verlopen automatisch (rolling window, opportunistische opschoning).

## Filterregels officiele alerts

1. Alert-id bevat `:GVB:` en
2. minstens een `informed_entity.stop_id` is een van onze tien
   veersteiger-GTFS-id's, of de NL-berichttekst bevat het woord "pont" of
   "veer" als los woord.
3. De actieve periode overlapt nu (of begint binnen 30 minuten).
4. Maximaal 5 alerts, nieuwste eerst; NL-tekst (deel voor " -- ").
