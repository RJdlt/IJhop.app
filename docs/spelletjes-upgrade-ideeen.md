# Spelletjes flink upgraden: ideeen en route

Werkdocument om samen te beslissen hoe we de arcade (nu Pont Hop) beter maken.
Uitgangspunt: de kracht van IJhop is de context. Je speelt 5 tot 13 minuten,
met een hand, staand op een pont, soms met anderen om je heen. Alles wat we
bouwen moet daar goed op passen: binnen seconden te starten, kort en bevredigend,
en het liefst iets dat past bij het IJ en Amsterdam.

## 1. Pont Hop zelf beter laten voelen (juice en variatie)

- Meer "sap": kort schermschudje bij een botsing, spatten bij het water, een
  glinstering plus tik-geluid bij een stroopwafel, een combo-teller als je meerdere
  stroopwafels achter elkaar pakt.
- Bijna-raak-moment: heel even slow-motion als je rakelings langs een boot springt.
  Voelt spannend en beloont goed spelen.
- Power-ups (thema IJ): reddingsboei (redt je een keer), stroomversnelling (korte
  boost), magneet (trekt stroopwafels aan), gouden pont (dubbele punten even).
- Meer obstakels met karakter: rondvaartboot, watertaxi, een duikende meeuw,
  drijfhout, en in de winter een ijsschots. Houdt het vers.
- Dag en nacht: het speelveld volgt de echte Amsterdamse tijd (ochtend, zonsondergang,
  nacht). Klein qua werk, groot voor de identiteit en het gevoel van "nu".

## 2. Een reden om terug te komen (dagelijkse uitdaging en streak)

- Dagelijkse uitdaging: elke dag een kort doel, bijvoorbeeld "steek 20 keer over",
  "pak 15 stroopwafels" of "haal 100 met de Pontkat". Beloning in stroopwafels.
- Speel-streak: speel je elke dag, dan loopt een reeks op met een kleine bonus.
  Simpel, maar het werkt.
- Stroopwafel-beloningstrack: een lichte variant van een battle pass. Naarmate je
  stroopwafels verdient, ontgrendel je mijlpalen (een skin, een kleurtje, een titel).

## 3. Sociaal: samen en tegen elkaar (de context uitbuiten)

- Live overtocht-race: iedereen die op dezelfde afvaart speelt, ziet elkaars score
  live oplopen. Bij aankomst een winnaar van de overtocht met een badge. De
  bouwstenen (overtocht-kamer, presence, live ranglijst) staan er al.
- Ghost-uitdaging: race tegen je eigen beste run, of tegen de score van de leider
  op deze overtocht ("versla RJ, 132"). Async, dus geen live verbinding nodig.
- Co-op relay: twee mensen op dezelfde pont spelen om een gezamenlijke teamscore.
  Sluit mooi aan op Pont Ontmoeting.

## 4. Meer variatie: een tweede (en derde) spel

De spel-registry is al klaar, dus een tweede spel toevoegen kan zonder de shell te
herschrijven. Ideeen die passen bij de pont (kort, een hand):

- Stroopwafel Stapelen: timing-spel, stapel wafels zo recht mogelijk. Heel
  laagdrempelig.
- Meeuw Alarm: tik snel de meeuwen weg die je patat proberen te jatten. Pure
  reactie, ideaal voor korte potjes.
- Pont Parkeren: leg de pont netjes aan met timing. Rustig en bevredigend.
- Reactieduel: een 1-tegen-1 tik-duel bestaat al als component; dat kunnen we als
  volwaardig spel in de arcade zetten, perfect voor twee mensen op de pont.
- IJ-quiz: korte weetjes over Amsterdam, NDSM en het IJ. Leuk en lokaal.

Advies: kies er een die zowel solo als samen leuk is. Reactieduel en Meeuw Alarm
scoren daar hoog op.

## 5. Meta en retentie

- Week- en maand-ranglijst met winnaars, gekoppeld aan de toekomstige prijzenactie
  (de inzendingen-tabel bestaat al). Dat geeft een reden om te blijven spelen.
- Seizoensevents: Koningsdag-skin die op de dag zelf gratis of gratis te verdienen
  is, een winter-thema, en dergelijke. Vers houden met weinig werk.

## 6. Polish en toegankelijkheid

- Korte, speelse tutorial (drie tikken) voor wie het nog nooit speelde.
- Geluid standaard uit blijft, maar met fijne effecten als je het aanzet.
- Grote tikdoelen, goed contrast, en een pauze-vriendelijke opzet (je stapt zo van
  de pont).

## Aanbevolen route

Fase 1 (gevoel en terugkeer, de grootste winst voor het minste werk):
- Juice toevoegen (schermschud, spatten, combo, geluid). Maakt elk potje leuker.
- Dagelijkse uitdaging plus een simpele streak. Geeft een reden om terug te komen.
- Dag-nacht-thema op basis van de echte tijd. Klein, maar sterk voor de identiteit.

Fase 2 (sociaal, de unieke IJhop-hoek):
- De live overtocht-race prominent maken, met een winnaar-moment bij aankomst.
- Ghost-uitdaging tegen de leider of je eigen record.

Fase 3 (variatie):
- Een tweede spel toevoegen (Reactieduel of Meeuw Alarm) via de bestaande registry.

## Wat ik als eerste zou doen

Beginnen met Fase 1, en daarbinnen met de juice plus de dagelijkse uitdaging.
Dat maakt Pont Hop meteen leuker en geeft mensen een reden om elke dag even te
spelen, zonder dat we iets groots hoeven te bouwen. Daarna de sociale overtocht-race,
want dat is precies waar IJhop uniek in is.
