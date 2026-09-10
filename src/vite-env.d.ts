/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build-tijdstempel, geïnjecteerd door Vite (zie vite.config.ts). */
declare const __BUILD_ID__: string
/** Commit-hash van deze build (7 tekens), of een tijdstempel als er geen git is. */
declare const __APP_VERSION__: string
/** Wanneer deze build gemaakt is, als ISO-tijdstempel. */
declare const __BUILT_AT__: string
