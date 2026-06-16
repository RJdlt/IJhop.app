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
  langName: string
  themeLight: string
  themeDark: string
  stopNames: Record<StopId, string>
  lastUpdated: string
  // Arcade
  arcade: {
    tabFerries: string
    tabGames: string
    playWhileWaiting: string
    title: string
    pickGame: string
    play: string
    restart: string
    menu: string
    close: string
    score: string
    best: string
    newRecord: string
    paused: string
    pausedDeparture: string
    drownTagline: string
    gameOver: string
    tryAgain: string
    mute: string
    unmute: string
    whichFerry: string
    justPlaying: string
    ferryLeaves: string
    playAnyway: string
    yourName: string
    save: string
    leaderboard: string
    noScoresYet: string
    shopTitle: string
    playerLevel: string
    choose: string
    chosen: string
    buy: string
    unlockAt: string
  }
  install: {
    title: string
    subtitle: string
    iosTitle: string
    ios1: string
    ios2: string
    ios3: string
    button: string
    dismiss: string
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
    langName: 'Nederlands',
    themeLight: 'Licht',
    themeDark: 'Donker',
    stopNames: {
      ndsm: 'NDSM-werf',
      centraal: 'Centraal Station',
      pontsteiger: 'Pontsteiger',
    },
    lastUpdated: 'Dienstregeling bijgewerkt',
    arcade: {
      tabFerries: 'Ponten',
      tabGames: 'Spelletjes',
      playWhileWaiting: 'Speel terwijl je wacht',
      title: 'IJhop Arcade',
      pickGame: 'Kies een spel',
      play: 'Speel',
      restart: 'Opnieuw',
      menu: 'Naar menu',
      close: 'Sluiten',
      score: 'Score',
      best: 'Record',
      newRecord: 'Nieuw record!',
      paused: 'Gepauzeerd',
      pausedDeparture: 'Je pont vertrekt zo — eerst varen.',
      drownTagline: 'Niet zweten, niet zwemmen',
      gameOver: 'Game over',
      tryAgain: 'Probeer opnieuw',
      mute: 'Geluid uit',
      unmute: 'Geluid aan',
      whichFerry: 'Welke pont wacht je op?',
      justPlaying: 'Alleen spelen',
      ferryLeaves: 'vertrekt zo',
      playAnyway: 'Speel toch door',
      yourName: 'Jouw naam',
      save: 'Opslaan',
      leaderboard: 'Toplijst',
      noScoresYet: 'Nog geen scores — speel de eerste!',
      shopTitle: 'Poppetjes',
      playerLevel: 'Niveau',
      choose: 'Kies',
      chosen: 'Gekozen',
      buy: 'Koop',
      unlockAt: 'Vrij bij',
    },
    install: {
      title: 'Zet IJhop op je beginscherm',
      subtitle: 'Open ’m als een echte app — schermvullend, sneller te openen en werkt offline.',
      iosTitle: 'Toevoegen op iPhone of iPad',
      ios1: 'Tik op het deelknopje onderaan in Safari',
      ios2: 'Tik op “Zet op beginscherm”',
      ios3: 'Open IJhop voortaan via het icoon op je startscherm',
      button: 'Zet op beginscherm',
      dismiss: 'Niet nu',
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
    langName: 'English',
    themeLight: 'Light',
    themeDark: 'Dark',
    stopNames: {
      ndsm: 'NDSM-werf',
      centraal: 'Central Station',
      pontsteiger: 'Pontsteiger',
    },
    lastUpdated: 'Timetable updated',
    arcade: {
      tabFerries: 'Ferries',
      tabGames: 'Games',
      playWhileWaiting: 'Play while you wait',
      title: 'IJhop Arcade',
      pickGame: 'Pick a game',
      play: 'Play',
      restart: 'Restart',
      menu: 'To menu',
      close: 'Close',
      score: 'Score',
      best: 'Best',
      newRecord: 'New record!',
      paused: 'Paused',
      pausedDeparture: 'Your ferry leaves soon — catch it first.',
      drownTagline: "Don't sweat, don't swim",
      gameOver: 'Game over',
      tryAgain: 'Try again',
      mute: 'Mute',
      unmute: 'Unmute',
      whichFerry: 'Which ferry are you waiting for?',
      justPlaying: 'Just playing',
      ferryLeaves: 'leaves soon',
      playAnyway: 'Keep playing',
      yourName: 'Your name',
      save: 'Save',
      leaderboard: 'Leaderboard',
      noScoresYet: 'No scores yet — be the first!',
      shopTitle: 'Characters',
      playerLevel: 'Level',
      choose: 'Select',
      chosen: 'Selected',
      buy: 'Buy',
      unlockAt: 'Unlock at',
    },
    install: {
      title: 'Add IJhop to your home screen',
      subtitle: 'Open it like a real app — full screen, quicker to launch and works offline.',
      iosTitle: 'Add it on iPhone or iPad',
      ios1: 'Tap the share button at the bottom of Safari',
      ios2: 'Tap “Add to Home Screen”',
      ios3: 'From now on open IJhop via the icon on your home screen',
      button: 'Add to home screen',
      dismiss: 'Not now',
    },
  },
}
