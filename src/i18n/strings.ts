import type { StopId } from '../types'

export type Lang = 'nl' | 'en'

export interface Strings {
  appName: string
  tagline: string
  liveBadge: string
  scheduleBadge: string
  now: string
  nextDepartures: string
  departsIn: string
  departingNow: string
  min: string
  sec: string
  crossing: string
  swapDirection: string
  favorite: string
  otherFerries: string
  // Storingen & vertragingen
  disruption: string
  delayAsk: string
  delayThanks: string
  delayAlready: string
  delayCrowd: string
  dismiss: string
  // Pushmeldingen
  pushTitle: string
  pushExplain: string
  pushEnable: string
  pushOff: string
  pushOn: string
  pushActiveFor: string
  pushDenied: string
  pushError: string
  // Offline
  offlineNote: string
  onbTitle: string
  onbSubtitle: string
  onbDone: string
  onbSkip: string
  to: string
  from: string
  noDepartures: string
  // Catch panel
  catchTitle: string
  catchSubtitle: string
  useLocation: string
  locating: string
  locationDenied: string
  locationUnavailable: string
  nearestPier: string
  walkTime: string
  away: string
  travelBy: string
  modeWalk: string
  modeBike: string
  modeScooter: string
  canMake: string
  cannotMake: string
  leaveNow: string
  leaveIn: string
  spareTime: string
  catchDirection: string
  refreshLocation: string
  // footer
  dataSource: string
  scheduleNote: string
  offlineReady: string
  updateAvailable: string
  refreshNow: string
  langName: string
  themeLight: string
  themeDark: string
  stopNames: Record<StopId, string>
  lastUpdated: string
  whichFerry: string
  noFerryChosen: string
  deals: {
    badge: string
    teaser: string
    grab: string
    walkFrom: string
    yourCode: string
    savedInApp: string
    validUntil: string
    route: string
    howTo: string
    redeemed: string
    redeemedNote: string
    redeemedThisWeek: string
    close: string
    tipFriend: string
    tipShare: string
    offlineNote: string
    previewTitle: string
    previewNote: string
    previewCode: string
  }
  install: {
    line: string
    button: string
    dismiss: string
    step1: string
    step2: string
  }
}

export const STRINGS: Record<Lang, Strings> = {
  nl: {
    appName: 'IJhop',
    tagline: 'niet zweten, niet zwemmen',
    liveBadge: 'Live',
    scheduleBadge: 'Dienstregeling',
    now: 'Nu',
    nextDepartures: 'Volgende afvaarten',
    departsIn: 'Vertrekt over',
    departingNow: 'Vertrekt nu',
    min: 'min',
    sec: 'sec',
    crossing: 'overtocht',
    swapDirection: 'Draai richting om',
    favorite: 'Favoriet',
    disruption: 'Storing',
    delayAsk: 'Vertraagd?',
    delayThanks: 'Gemeld, dank je!',
    delayAlready: 'Al gemeld',
    delayCrowd: 'reizigers melden vertraging',
    dismiss: 'Sluiten',
    pushTitle: 'Melding bij storing',
    pushExplain: 'Krijg een seintje als jouw favoriete pont niet vaart. Alleen storingen, nooit reclame.',
    pushEnable: 'Zet aan',
    pushOff: 'Uit',
    pushOn: 'Staat aan. Je hoort het als er iets is.',
    pushActiveFor: 'Actief voor',
    pushDenied: 'Meldingen zijn geblokkeerd in je browser. Zet ze aan via de site-instellingen.',
    pushError: 'Aanzetten lukte niet. Probeer het later nog eens.',
    offlineNote: 'Offline. Tijden volgens de vaste dienstregeling.',
    otherFerries: 'Andere pontjes',
    onbTitle: 'Welke pontjes pak je het meest?',
    onbSubtitle: 'Zet ze als favoriet, dan houden we je scherm overzichtelijk. Aanpassen kan altijd via de ster.',
    onbDone: 'Klaar',
    onbSkip: 'Later kiezen',
    to: 'naar',
    from: 'vanaf',
    noDepartures: 'Geen afvaarten gevonden.',
    catchTitle: 'Haal jij de pont nog?',
    catchSubtitle: 'Bereken vanaf je locatie welke afvaart je nog haalt.',
    useLocation: 'Gebruik mijn locatie',
    locating: 'Locatie bepalen…',
    locationDenied: 'Geen toegang tot je locatie. Sta dit toe in je browser.',
    locationUnavailable: 'Locatie niet beschikbaar.',
    nearestPier: 'Dichtstbijzijnde pont',
    walkTime: 'looptijd',
    away: 'lopen',
    travelBy: 'Hoe ga je?',
    modeWalk: 'Lopen',
    modeBike: 'Fiets',
    modeScooter: 'Scooter',
    canMake: 'Je haalt het',
    cannotMake: 'Net te laat',
    leaveNow: 'Vertrek nu',
    leaveIn: 'Vertrek over',
    spareTime: 'speling',
    catchDirection: 'Richting',
    refreshLocation: 'Locatie vernieuwen',
    dataSource: 'Bron: officiële GVB-dienstregeling (GTFS)',
    scheduleNote:
      'Tijden volgens de gepubliceerde dienstregeling. De aftelklok loopt live mee op Amsterdamse tijd.',
    offlineReady: 'Werkt offline',
    updateAvailable: 'Nieuwe versie beschikbaar',
    refreshNow: 'Verversen',
    langName: 'Nederlands',
    themeLight: 'Licht',
    themeDark: 'Donker',
    stopNames: {
      ndsm: 'NDSM-werf',
      centraal: 'Centraal Station',
      pontsteiger: 'Pontsteiger',
    },
    lastUpdated: 'Dienstregeling bijgewerkt',
    whichFerry: 'Welke pont wacht je op?',
    noFerryChosen: 'Even geen pont',
    deals: {
      badge: 'Pontdeal',
      teaser: 'Volgende Pontdeal: maandag',
      grab: 'Pak je deal',
      walkFrom: 'min van',
      yourCode: 'Jouw code',
      savedInApp: 'bewaard in de app',
      validUntil: 'geldig t/m woensdag 23:59',
      route: 'Route',
      howTo: 'Zo werkt het: laat dit scherm zien bij de kassa.',
      redeemed: 'Ingewisseld',
      redeemedNote: 'Fijne dag verder.',
      redeemedThisWeek: 'keer ingewisseld deze week',
      close: 'Terug naar de klok',
      tipFriend: 'Tip een vriend',
      tipShare: 'Elke week een deal voor wie op de pont wacht.',
      offlineNote: 'Je code staat in de app, ook zonder bereik.',
      previewTitle: 'Preview',
      previewNote: 'Alleen jij ziet dit. De deal staat nog niet live en niets hiervan telt mee.',
      previewCode: 'Testcode',
    },
    install: {
      line: 'Zet IJhop op je beginscherm: één tik en je ziet de volgende pont, ook zonder internet.',
      button: 'Zet op beginscherm',
      dismiss: 'Niet nu',
      step1: 'Tik op het deelknopje onderaan in Safari',
      step2: 'Tik op “Zet op beginscherm”',
    },
  },
  en: {
    appName: 'IJhop',
    tagline: "don't sweat, don't swim",
    liveBadge: 'Live',
    scheduleBadge: 'Timetable',
    now: 'Now',
    nextDepartures: 'Next departures',
    departsIn: 'Departs in',
    departingNow: 'Departing now',
    min: 'min',
    sec: 'sec',
    crossing: 'crossing',
    swapDirection: 'Swap direction',
    favorite: 'Favourite',
    disruption: 'Disruption',
    delayAsk: 'Delayed?',
    delayThanks: 'Reported, thanks!',
    delayAlready: 'Already reported',
    delayCrowd: 'travellers report a delay',
    dismiss: 'Dismiss',
    pushTitle: 'Disruption alerts',
    pushExplain: 'Get a heads-up when your favourite ferry is not sailing. Disruptions only, never ads.',
    pushEnable: 'Turn on',
    pushOff: 'Off',
    pushOn: 'Enabled. We will let you know if something is up.',
    pushActiveFor: 'Active for',
    pushDenied: 'Notifications are blocked in your browser. Enable them in the site settings.',
    pushError: 'Could not enable. Please try again later.',
    offlineNote: 'Offline. Times follow the regular timetable.',
    otherFerries: 'Other ferries',
    onbTitle: 'Which ferries do you take most?',
    onbSubtitle: 'Set them as favourites to keep your screen tidy. You can always change it with the star.',
    onbDone: 'Done',
    onbSkip: 'Choose later',
    to: 'to',
    from: 'from',
    noDepartures: 'No departures found.',
    catchTitle: 'Can you still catch it?',
    catchSubtitle: 'From your location, see which ferry you can still make.',
    useLocation: 'Use my location',
    locating: 'Getting location…',
    locationDenied: 'No access to your location. Allow it in your browser.',
    locationUnavailable: 'Location unavailable.',
    nearestPier: 'Nearest pier',
    walkTime: 'walk',
    away: 'away',
    travelBy: 'How do you go?',
    modeWalk: 'Walk',
    modeBike: 'Bike',
    modeScooter: 'Scooter',
    canMake: "You'll make it",
    cannotMake: 'Just missed',
    leaveNow: 'Leave now',
    leaveIn: 'Leave in',
    spareTime: 'to spare',
    catchDirection: 'Direction',
    refreshLocation: 'Refresh location',
    dataSource: 'Source: official GVB timetable (GTFS)',
    scheduleNote:
      'Times follow the published timetable. The countdown ticks live on Amsterdam time.',
    offlineReady: 'Works offline',
    updateAvailable: 'New version available',
    refreshNow: 'Refresh',
    langName: 'English',
    themeLight: 'Light',
    themeDark: 'Dark',
    stopNames: {
      ndsm: 'NDSM-werf',
      centraal: 'Central Station',
      pontsteiger: 'Pontsteiger',
    },
    lastUpdated: 'Timetable updated',
    whichFerry: 'Which ferry are you waiting for?',
    noFerryChosen: 'No ferry right now',
    deals: {
      badge: 'Ferry deal',
      teaser: 'Next ferry deal: Monday',
      grab: 'Get your deal',
      walkFrom: 'min from',
      yourCode: 'Your code',
      savedInApp: 'saved in the app',
      validUntil: 'valid until Wednesday 23:59',
      route: 'Directions',
      howTo: 'How it works: show this screen at the counter.',
      redeemed: 'Redeemed',
      redeemedNote: 'Enjoy your day.',
      redeemedThisWeek: 'redeemed this week',
      close: 'Back to the clock',
      tipFriend: 'Tell a friend',
      tipShare: 'A deal every week for anyone waiting for the ferry.',
      offlineNote: 'Your code stays in the app, even without signal.',
      previewTitle: 'Preview',
      previewNote: 'Only you can see this. The deal is not live yet and nothing here counts.',
      previewCode: 'Test code',
    },
    install: {
      line: 'Add IJhop to your home screen: one tap and you see the next ferry, even without internet.',
      button: 'Add to home screen',
      dismiss: 'Not now',
      step1: 'Tap the share button at the bottom of Safari',
      step2: 'Tap “Add to Home Screen”',
    },
  },
}
