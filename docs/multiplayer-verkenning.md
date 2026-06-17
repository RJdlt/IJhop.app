# Samen spelen op de pont: technische verkenning

Doel: mensen die op dezelfde pont staan (5 tot 13 minuten) samen of tegen elkaar
Pont Hop laten spelen. Dit is een groter realtime-project. Hieronder de aanpak,
de uitdagingen en een gefaseerd plan, zodat we kunnen beslissen of en wanneer we
het bouwen. Er is in deze fase bewust nog niets gebouwd.

## Aanpak: Supabase Realtime

We hebben al Supabase en gebruiken Realtime al voor presence en broadcast. Dat
is de logische basis.

- Presence: laat zien wie er "in dezelfde ruimte" is (bijvoorbeeld dezelfde
  afvaart). We hebben al een overtocht-kamer (lijn plus vertrekmoment) die als
  room-key kan dienen.
- Broadcast: lichte berichten over een kanaal (score-updates, start, klaar).
- Postgres changes: niet nodig voor de live game; te traag en te zwaar voor
  per-frame updates.

Model in het kort:
- Iedereen op dezelfde overtocht joint hetzelfde Realtime-kanaal.
- We sturen geen volledige spelstaat rond, maar alleen lichte gebeurtenissen:
  "ik ben begonnen", "mijn score is nu X", "ik ben game over op X".
- Het scherm toont een live mini-ranglijst van de mensen op jouw overtocht. Dat
  is feitelijk een live versie van de bestaande overtocht-ranglijst.

Belangrijk inzicht: we hoeven de spellen niet frame-voor-frame te synchroniseren
om het leuk te maken. Een gedeelde live-score (race naar de hoogste score binnen
de overtocht) geeft 80 procent van het samenspeel-gevoel met 20 procent van de
complexiteit.

## Twee niveaus van "samen spelen"

1. Gedeelde competitie (eenvoudig, aanrader als eerste stap)
   - Iedereen speelt zijn eigen potje, maar ziet live de scores van de anderen
     op dezelfde overtocht.
   - Geen synchronisatie van de wereld nodig. Lage latency-eisen.
   - Bouwt voort op wat er al is (presence plus overtocht-ranglijst).

2. Echte gedeelde wereld (complex, later)
   - Iedereen speelt in dezelfde gegenereerde wereld, ziet elkaars poppetjes
     bewegen.
   - Vereist een gedeelde seed, deterministische engine (die hebben we) en het
     rondsturen van bewegingen met interpolatie.
   - Veel gevoeliger voor latency en valsspelen.

## Uitdagingen

- Matchmaking per pont: wie hoort bij welke groep? De overtocht-kamer (lijn plus
  geplande vertrekseconde) werkt goed, maar randgevallen: iemand kiest geen pont,
  twee ponten vlak na elkaar, of mensen openen de app net te laat. Oplossing: val
  terug op een "vrij spelen"-kanaal als er geen overtocht actief is.
- Latency: mobiel net op het water is wisselend. Voor niveau 1 (gedeelde score)
  is dat geen probleem. Voor niveau 2 (gedeelde wereld) wel; daar is interpolatie
  en het tolereren van vertraging essentieel.
- Oneerlijk spel: scores komen nu van de client en zijn dus te vervalsen. Voor
  een gezellige pont-ranglijst is dat acceptabel. Wil je echte prijzen koppelen,
  dan is server-side validatie nodig (bijvoorbeeld plausibiliteitschecks op
  score per tijd, of het narekenen van een seed plus invoer).
- Privacy: alleen een zelfgekozen bijnaam tonen, geen e-mail of locatie. Dat doen
  we al.
- Verlaten en herverbinden: mensen stappen van de pont, verliezen verbinding of
  sluiten de app. Presence lost het meeste op (mensen vallen vanzelf weg).
- Misbruik van kanalen: rate limits op broadcast en een maximum aan spelers per
  kamer.

## Gefaseerd plan

Fase 0 (klaar): presence en een overtocht-ranglijst bestaan al.

Fase 1: Live gedeelde scores per overtocht
- Bij game over en bij elke nieuwe persoonlijke topscore een licht broadcast-
  bericht sturen naar de overtocht-kamer.
- Een live mini-ranglijst tonen tijdens en na het spelen: "jij staat 2e van 5 op
  deze overtocht".
- Klein, bouwt op bestaande bouwstenen, lage latency-eisen.

Fase 2: Lobby en rondes
- Een gedeelde aftel-start: "volgende ronde begint over 10 seconden", iedereen
  start tegelijk met dezelfde seed.
- Aan het eind een duidelijke winnaar van die ronde.
- Vereist een simpele lobby-status in het kanaal (wachten, aftellen, bezig,
  afgelopen).

Fase 3: Anti-valsspelen (alleen nodig bij echte prijzen)
- Server-side plausibiliteitscheck of het narekenen van scores.
- Pas bouwen als er echt iets te winnen valt.

Fase 4 (optioneel, complex): Gedeelde wereld
- Poppetjes van anderen live in jouw wereld met interpolatie.
- Alleen doen als fase 1 en 2 aantoonbaar leuk zijn en de wens er is.

## Advies

Begin klein met Fase 1 (live gedeelde scores per overtocht). Dat geeft het
samenspeel-gevoel, hergebruikt wat er al is, en is in een paar dagen te bouwen.
Beslis pas daarna of de zwaardere fases de moeite waard zijn.
