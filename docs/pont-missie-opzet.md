# De Pont-Missie: samen de IJ over (opzet)

Werktitel: De Pont-Missie. Een korte, speelse co-op-belevenis voor de mensen die
samen op dezelfde pont staan, die ongeveer 13 minuten duurt (de overtocht), en
die mensen aanzet om elkaar te vinden en samen iets op te lossen. Dit is een
ontwerp-opzet, nog geen code.

## Het idee in een zin

Mensen op dezelfde overtocht vormen kort een team, vinden elkaar bij een
afgesproken plek op de pont (bijvoorbeeld de linker prullenbak), en lossen samen
een luchtige missie op die precies binnen de overtocht past. Niemand kan het
alleen: ieder ziet op zijn telefoon iets anders.

## Waarom dit past bij IJhop

- De tijd is al afgebakend en natuurlijk: de overtocht duurt 5 tot 13 minuten.
- We weten al wie op dezelfde overtocht zit: we hebben een overtocht-kamer (lijn
  plus gepland vertrekmoment) en presence. Dat is de basis voor matchmaking.
- Het past bij het merk: niet zweten, niet zwemmen. Even samen iets leuks doen
  terwijl je toch moet wachten.

## De reis van de speler (vier fases)

### Fase 1: Op de steiger, voor de pont (de lobby)
- Je hebt in IJhop je pont gekozen (of we leiden 'm af uit de aftelklok). Vanaf
  een paar minuten voor vertrek verschijnt een rustige kaart: "Speel samen deze
  overtocht. Er doen nu 2 anderen mee op de F7 van 17:42."
- Eén tik op "Doe mee" plaatst je in een team (klein, 2 tot 4 mensen).
- Je krijgt meteen twee dingen:
  1. Een team-identiteit: een kleur plus dier, bijvoorbeeld "Team Groene Reiger".
  2. Een treffpunt aan boord: "Verzamel bij de linker prullenbak, aan de kant
     van het stuurhuis."
- Zo begint het samen al voor je aan boord bent. Je weet wie je zoekt en waar.

### Fase 2: Instappen en elkaar vinden (het treffpunt)
- Aan boord open je de app en houd je je scherm even omhoog: een groot gekleurd
  embleem (jullie teamkleur plus dier) zodat teamgenoten je herkennen.
- Bij de afgesproken plek (de linker prullenbak) druk je op "Ik ben er". Zodra
  iedereen van het team dat heeft gedaan (presence bevestigt het), start de
  missie. Lukt verzamelen niet helemaal? Dan start het ook automatisch zodra de
  pont vaart, zodat niemand vastloopt.

### Fase 3: Aan boord, de missie (ongeveer 13 minuten)
- De missie loopt tijdens de overtocht. Ieder ziet op zijn telefoon een ander
  stukje. Je moet praten, kijken en samen handelen. Je kunt elkaars scherm niet
  zien; je vertelt wat je ziet.
- De missie is kort, vergevingsgezind en speels (zie hieronder voor varianten).
- Een aftelbalk volgt de overtocht, zodat de spanning meeloopt met de reis.

### Fase 4: Aankomst (de ontknoping)
- Net voor het aanmeren komt de ontknoping: gelukt of net niet, met een
  vrolijke reveal.
- Beloning: een gedeelde plek op de overtocht-ranglijst, een teambadge, of later
  iets tastbaars (bijvoorbeeld via de sponsor of een NDSM-restaurant; nu nog niet
  bouwen).

## Hoe vind je elkaar

Drie lagen, van digitaal naar fysiek, zodat het altijd werkt:

1. Digitaal samenvoegen: de overtocht-kamer koppelt iedereen op dezelfde afvaart
   die meedoet. Dat gebeurt al voor de pont, op de steiger.
2. Herkenning: teamkleur plus dier, en een groot embleem op je scherm dat je
   omhoog kunt houden. Optioneel een kort codewoord ("zeg: reiger").
3. Fysiek treffpunt: een vaste, herkenbare plek op de pont. "Linker prullenbak"
   is een mooi voorbeeld: concreet, grappig, en iedereen snapt het. Per richting
   kun je een ander treffpunt kiezen zodat het klopt met de indeling van de boot.

Belangrijk: het fysieke treffen is de charme, maar mag nooit verplicht of
ongemakkelijk voelen. De missie moet ook werkbaar zijn als mensen op afstand
blijven staan en alleen via de app en hun stem samenwerken.

## Wat doe je samen (missie-varianten)

Het sterke idee uit jouw inspiratie: ieder ziet iets anders, dus je moet praten.
Drie varianten, oplopend in complexiteit.

### Variant A: De Overtocht-Code (aanrader als eerste versie)
- Elk teamlid ziet een stukje van een code of aanwijzing. Samen vormt het een
  woord of route. Aan het eind typt iedereen het volledige antwoord in en de
  "missie" is geslaagd.
- Simpel, kort, lage techniek-eisen. Perfect om mee te beginnen.

### Variant B: Samen Pont Hop (teamscore)
- Iedereen speelt zijn eigen potje Pont Hop, maar de scores tellen live op tot
  een gezamenlijke teamscore. Je moedigt elkaar aan en ziet live wie voor staat.
- Hergebruikt het bestaande spel; vooral een gedeelde live-ranglijst per
  overtocht. Weinig nieuw nodig.

### Variant C: Asymmetrische mini-missie (zoals jouw drie-rollen-idee)
- Drie rollen, ieder ziet andere informatie (bijvoorbeeld: een richtingaanwijzer,
  een tabel, en een signaal). Samen los je een paar korte opdrachten op die qua
  thema bij de pont en het IJ passen.
- Het leukst en het meest "samen", maar ook het meest werk. Iets voor later, als
  A of B aanslaat.

## Tijdlijn van een overtocht (richtlijn)

- T minus 4 min (op de steiger): lobby open, team vormt zich.
- T 0 (vertrek): missie start automatisch als je nog niet verzameld bent.
- T plus 1 tot 2 min: elkaar gevonden, eerste opdracht.
- T plus 2 tot 10 min: de missie zelf, in korte stappen.
- T plus 11 tot 12 min: laatste stap en aftellen.
- Aankomst: reveal en beloning, daarna netjes afsluiten.

## Techniek (op hoofdlijnen, hergebruik wat er is)

- Matchmaking: de bestaande overtocht-kamer (lijn plus geplande vertrekseconde)
  is de team-sleutel. Iedereen die meedoet op dezelfde afvaart zit in hetzelfde
  Realtime-kanaal.
- Aanwezigheid: Supabase Realtime presence (hebben we al) voor "wie doet mee" en
  "wie is verzameld".
- Spelstaat: Supabase Realtime broadcast voor lichte berichten (start, stap
  klaar, antwoord ingevoerd). Geen zware per-frame sync nodig voor varianten A en
  B.
- Gelijke puzzel voor iedereen: een gedeelde seed per overtocht, zodat ieder
  teamlid hetzelfde (maar zijn eigen stukje van het) raadsel krijgt. De engine
  van Pont Hop is al deterministisch met een seed, dus dat patroon kennen we.
- Teamgrootte: klein houden (2 tot 4). Bij meer mensen meerdere teams op dezelfde
  overtocht.

## Gefaseerd bouwplan

- Fase 0 (klaar): overtocht-kamer en presence bestaan al.
- Fase 1: Lobby plus teamvorming op de steiger, teamkleur plus treffpunt, en
  variant A (De Overtocht-Code). Klein en af te ronden in een paar dagen.
- Fase 2: Variant B (samen Pont Hop, live teamscore) en een gedeelde reveal bij
  aankomst.
- Fase 3: Variant C (asymmetrische rollen) als A en B aantoonbaar leuk zijn.
- Fase 4: Beloningen koppelen (sponsor of restaurant), pas als er publiek is.

## Aandachtspunten en risico's

- Lege ponten: vaak sta je er met weinig mensen. Altijd een terugval: speel solo
  of met een willekeurige buddy, of "team van 1" met een mini-uitdaging. Het mag
  nooit doodlopen omdat er niemand anders is.
- Vreemden: niet iedereen wil praten met onbekenden. Maak meedoen volledig
  vrijwillig, laat het ook werken zonder fysiek treffen, en houd de toon licht.
- Veiligheid en comfort: geen persoonsgegevens, alleen een zelfgekozen bijnaam.
  Geen druk om naar iemand toe te lopen.
- Korte en wisselende tijd: de overtocht varieert (5 tot 13 minuten) en het net
  op het water is wisselend. Houd missies kort, met duidelijke stappen, en zorg
  dat een hapering niet alles breekt.
- Eerlijk en simpel starten: begin met variant A, leer van echt gebruik, en bouw
  daarna pas zwaarder.

## Advies

Begin met Fase 1: de lobby op de steiger, teamkleur plus treffpunt (de linker
prullenbak), en variant A (De Overtocht-Code). Dat geeft het samen-gevoel, het
fysieke vinden, en de tijdsdruk van de overtocht, met de minste techniek. Daarna
beslis je op basis van echt gebruik of de zwaardere varianten de moeite waard
zijn.
