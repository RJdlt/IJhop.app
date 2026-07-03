# Besluitnotitie: wat de PWA wel en niet kan

Datum: 3 juli 2026. Context: de concurrent (Amsterdam Pont App, iOS native)
verkoopt lock-screen-widgets als premium. Dit document legt vast wat wij als
PWA wel en niet kunnen, zodat een eventueel later native besluit op feiten rust.

## Wat de PWA WEL kan (en sinds Fase 3 doet)

- **Web push notifications**: storingsmeldingen voor favoriete lijnen, opt-in.
  Werkt op Android/Chrome volledig. Op iOS sinds 16.4, maar alleen als de app
  aan het beginscherm is toegevoegd; de "voeg toe"-uitleg is daarmee ook de
  poort naar meldingen op iPhone.
- **App shortcuts** (long-press op het app-icoon): direct naar de aftelklok of
  de arcade. Android volledig; iOS negeert dit manifest-veld stilzwijgend.
- **Volledig offline**: de dienstregeling zit in de app-bundel; de aftelklok
  werkt zonder netwerk, met een eerlijke offline-indicator en de datum van de
  ingebouwde dienstregeling.

## Wat de PWA NIET kan

- **Lock-screen-widgets / home-screen-widgets** (het premium-argument van de
  concurrent): geen web-API voor. Widgets vereisen native code (WidgetKit op
  iOS, Glance/AppWidget op Android).
- **Live Activities** (iOS, live aftelklok op het vergrendelscherm): idem,
  alleen native. Zou voor "haal ik de pont?" de perfecte vorm zijn.
- **Betrouwbare achtergrond-verversing**: een PWA draait alleen als hij
  open is of een push ontvangt.

## Afweging

Widgets zijn een echte featuregap, maar geen reden om nu native te gaan:
1. Onze verdedigbare voorsprong (gratis, direct via URL, spellen, NL) staat
   los van widgets.
2. Push op storingen dekt de belangrijkste widget-behoefte (word gewaarschuwd
   zonder de app te openen) grotendeels af.
3. Native betekent App Store-review, twee codebases of een wrapper, en een
   downloaddrempel die precies ons voordeel ("geen download nodig") opeet.

Herzie dit besluit als: (a) meetbaar veel gebruikers om widgets vragen,
(b) de web-standaarden widgets krijgen, of (c) er budget is voor een dunne
native wrapper (Capacitor) rond de bestaande PWA plus een WidgetKit-widget.
