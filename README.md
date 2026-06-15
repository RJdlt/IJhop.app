# IJhop 🛥️

> **[ijhop.app](https://ijhop.app)**

Live vertrektijden voor de **GVB-ponten over het IJ** in Amsterdam — een snelle,
moderne, tweetalige (NL/EN) web-app die je laat zien wanneer de volgende pont
vaart en of je 'm nog haalt.

> Vervangt apps als _Ferry Nice_ / _Timey!_ met een schone, installeerbare PWA
> die ook **offline** werkt.

## Lijnen

| Lijn | Verbinding | Overtocht |
| ---- | ---------- | --------- |
| **F4** | NDSM-werf ↔ Centraal Station | ~13 min |
| **F7** | NDSM-werf ↔ Pontsteiger | ~5 min |

Beide richtingen, met een live aftelklok op **Amsterdamse tijd** (klopt ook als
je telefoon in een andere tijdzone staat).

## Features

- ⏱️ **Live aftelklok** naar de eerstvolgende afvaarten per richting.
- 🔄 **Richting omdraaien** met één tik.
- 📍 **"Haal jij de pont nog?"** — bepaalt vanaf je locatie de dichtstbijzijnde
  pont, je looptijd ernaartoe, en welke afvaart je nog kunt halen.
- 🌗 **Licht/donker thema** en 🇳🇱/🇬🇧 **NL/EN** taalwissel (onthouden).
- 📲 **Installeerbare PWA** die volledig **offline** werkt — de hele
  dienstregeling zit in de app, dus geen bereik nodig aan de waterkant.

## Data

De dienstregeling komt uit de **officiële GVB GTFS-feed** (via
`gtfs.ovapi.nl/nl`). `scripts/generate-timetable.py` downloadt die feed, filtert
op lijn F4 en F7, en distilleert een compact **wekelijks patroon**
(`src/data/timetable.json`).

De ponten varen op dienstregeling (geen live GPS-tracking zoals tram/metro),
dus de "live data" is de **realtime aftelklok** naar de gepubliceerde tijden —
altijd actueel en zonder server nodig.

```bash
# Dienstregeling verversen na een GVB-wijziging:
python3 scripts/generate-timetable.py
```

Iconen worden uit `public/icon.svg` gegenereerd:

```bash
node scripts/generate-icons.mjs
```

## Ontwikkelen

```bash
npm install
npm run dev        # lokale dev-server
npm run build      # type-check + productie-build naar dist/
npm run preview    # productie-build lokaal serveren
```

**Stack:** Vite · React 19 · TypeScript (strict) · Tailwind CSS · vite-plugin-pwa.

## Architectuur

```
src/
├── data/timetable.json   # gegenereerd wekelijks dienstregelingspatroon
├── lib/
│   ├── time.ts           # Amsterdamse tijd via Intl → seconde-van-de-week
│   ├── schedule.ts       # volgende afvaarten op een "week-ring" (wrap rond middernacht)
│   ├── geo.ts            # haversine-afstand + looptijd naar de ponten
│   └── format.ts         # countdown- en relatieve-tijd-labels
├── hooks/                # useNow (tikkende klok), useGeolocation, useTheme
├── i18n/                 # NL/EN strings + context
└── components/           # Header, RouteCard, CatchPanel, Footer
```

De roosterberekening plaatst elke afvaart op een **seconde-van-de-week** ring,
zodat afvaarten na middernacht en de zondag→maandag-overgang vanzelf goed
doorrollen.
