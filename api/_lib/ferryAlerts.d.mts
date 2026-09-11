/** Typedeclaraties bij ferryAlerts.mjs (voor tsc en de vitest-suite). */

export interface FeedEntity {
  id: string
  alert?: {
    informedEntity?: { routeId?: string | null; stopId?: string | null }[] | null
    activePeriod?: { start?: string | number | null; end?: string | number | null }[] | null
    headerText?: { translation?: { text?: string | null; language?: string | null }[] | null } | null
    descriptionText?: { translation?: { text?: string | null; language?: string | null }[] | null } | null
  } | null
}

export interface FerryAlert {
  id: string
  header: string
  stops: string[]
  /** Netwerkbreed bericht (staking): raakt alle veerlijnen. */
  networkWide: boolean
  /** De geraakte veerlijnen, al uitgerekend door het filter. */
  lines: string[]
  start: number | null
  end: number | null
}

export declare const FERRY_STOP_IDS: Record<string, string>
export declare const FERRY_LINES: Record<string, string[]>
export declare function filterFerryAlerts(entities: FeedEntity[], nowSec: number): FerryAlert[]
export declare function alertLines(alert: FerryAlert): string[]
export declare function isNetworkWide(header: string, body: string): boolean
export declare function mentionsOtherMode(text: string): boolean
export declare function mentionsFerry(text: string): boolean
export declare function linesFromText(text: string): string[]
export declare function resolveLines(stops: string[], text: string, networkWide: boolean): string[]
