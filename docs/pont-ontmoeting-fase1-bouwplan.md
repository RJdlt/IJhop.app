# Pont Ontmoeting: technisch bouwplan Fase 1

Dit bouwplan hoort bij jouw conceptdoc "Pont Ontmoeting" (versie 0.1). Het werkt
Fase 1 concreet uit, zodat het klaarligt om te bouwen zodra je dat wilt. Het
respecteert jouw kaders: 1-op-1, fysiek eerst, geen locatiedeling, offline-
bestendig, vrijblijvend en veilig.

Belangrijk vooraf: jouw eigen conclusie blijft staan. De echte eerste stap is
Fase 0, in het echt testen met twee telefoons op de pont. Dit plan is voor als je
daarna gaat bouwen.

## Fase 1, scope

De simpelste werkende versie:
- Aanmelden voor een overtocht binnen IJhop.
- Twee mensen koppelen via Supabase Realtime.
- Allebei hetzelfde signaal (kleur plus symbool plus codewoord) en een vaste
  ontmoetingsplek tonen.
- Eén opdracht: de geheime high five of het codewoord. Allebei drukken op
  "gelukt".

## De schermen (states)

1. Uitnodiging (hoofdscherm of bij de aftelklok): "Staat er iemand klaar voor een
   Pont Ontmoeting?" met een meedoen-knop. Verschijnt als je een overtocht hebt
   gekozen en die binnen het venster valt.
2. Wachten op een match: "Nog niemand klaar. We laten het weten zodra er iemand
   is." Met een nette annuleren-knop.
3. Gematcht: groot gekleurd scherm met het signaal (kleur, symbool), het
   codewoord, en de vaste plek ("Zoek elkaar bij de linker prullenbak"). Een knop
   "Ik heb de ander gevonden".
4. Samen: de korte opdracht (high five of codewoord) met een "gelukt"-knop.
5. Gelukt: een klein gedeeld momentje. Daarna netjes afsluiten.
6. Veiligheid, altijd bereikbaar: een onopvallende "liever niet / negeren"-knop en
   een eenvoudige manier om gedrag te melden.

## Matchmaking 1-op-1 (zonder zware server-logica)

We hergebruiken de overtocht-kamer (lijn plus gepland vertrekmoment) als de
matchruimte, en Supabase Realtime presence om te zien wie klaarstaat.

- Kanaal: presence op `ontmoeting:{overtocht-kamer}`. Iedereen die op meedoen
  tikt, joint dit kanaal.
- Koppelen: uit de presence-lijst (die beide kanten zien) leiden we deterministisch
  paren af. Sorteer de user-ids en groepeer per twee. Beide mensen rekenen lokaal
  hetzelfde paar uit, dus je hebt geen aparte matchmaking-server nodig.
- Match-seed: `matchSeed(overtocht, userA, userB)` (al gebouwd, volgorde maakt
  niet uit). Daaruit volgt met `buildSignal(seed)` exact hetzelfde signaal plus
  dezelfde plek voor allebei.
- Oneven aantal: wie geen paar heeft, blijft netjes in "wachten op een match".

## Offline-bestendig

Zodra je gematcht bent, is het signaal plus de plek lokaal te berekenen uit de
seed. Je hebt op het moment zelf geen live verbinding meer nodig om elkaar te
vinden. Dat is precies waarom "signaal plus vaste plek" zo robuust is op het IJ.
De enige live momenten zijn het koppelen vooraf en (optioneel) het delen van
"gelukt".

## Wat we hergebruiken

- `src/lib/rooms.ts` en de bestaande overtocht-kamer-afleiding in App.
- `src/hooks/usePresence.ts` voor wie er klaarstaat en wie gematcht is.
- `src/hooks/useBroadcast.ts` voor lichte berichten (optioneel: "gelukt").
- `src/hooks/useAnonSession.ts` voor het anonieme user-id.
- `src/arcade/ontmoeting/signal.ts` voor het gedeelde signaal plus plek (klaar en
  getest).

## Veiligheid en privacy (hard in het ontwerp)

- Volledig vrijwillig, en altijd te stoppen zonder dat de ander iets ziet.
- Geen locatiedeling, geen verplichte naam, geen privégegevens. Herkenning via
  signaal en vaste plek.
- Publiek en kort, op een drukke pont. Een eenvoudige "negeren" en een melding-
  optie voor ongewenst gedrag.
- Toon nooit iets dat als dating voelt.

## Fallback en randgevallen

- Niemand beschikbaar: nette wachtstand, geen eindeloos laden.
- Verbinding kwijt vlak na het matchen: het signaal plus de plek staan er al
  (lokaal), dus je kunt elkaar alsnog vinden.
- Rustige pont: vaak sta je er alleen. De uitnodiging mag dan klein blijven of
  helemaal niet verschijnen, zodat het niet als een lege belofte voelt.

## Bouwvolgorde (kleine, testbare stappen)

1. Klaar: `signal.ts` (gedeeld signaal plus plek, deterministisch, getest).
2. Een hook `useOntmoeting(overtochtRoom, userId)` die presence joint, het paar
   afleidt en de match-seed teruggeeft.
3. De uitnodigingskaart plus de wachtstand (states 1 en 2), achter een vlag, alleen
   als er een overtocht actief is.
4. Het gematcht-scherm met signaal plus plek (state 3), volledig uit de seed.
5. De opdracht plus "gelukt" (states 4 en 5), met optioneel een broadcast zodat je
   samen het gelukt-moment ziet.
6. Veiligheidsknoppen, analytics-events (meedoen, match-gelukt, afgerond), en
   nette teksten.

## Meten (om te leren of het werkt)

- Hoeveel mensen tikken op meedoen?
- Hoe vaak ontstaat er echt een match (tweede deelnemer aanwezig)?
- Hoe vaak drukken beide op "gelukt"?

Deze cijfers passen in het bestaande analytics-dashboard via gewone events.

## Eerst dit (jouw eigen conclusie, en terecht)

Niet bouwen, maar Fase 0 in het echt doen: pak een vriend, ga naar de pont, spreek
een signaal en een plek af, en doe de geheime high five. Let op of het leuk of
ongemakkelijk voelt, en of vreemden hier echt aan mee zouden doen. Wat je daar
leert bepaalt of en hoe we Fase 1 bouwen.
