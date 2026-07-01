/**
 * Gedeelde arcade-stijl voor een premium, "2030" uitstraling: een diepe
 * gradient-achtergrond met zachte groene gloed, glas-kaarten (glassmorphism) en
 * een glow-actieknop. Eén plek zodat alle panelen consistent ogen.
 */

// Donkere achtergrond met een zachte brand-groene gloed bovenaan.
export const arcadeBg =
  'bg-[radial-gradient(120%_90%_at_50%_-10%,#0c6b52_0%,#063f30_38%,#02140f_100%)]'

// Glas-kaart (grote en zachtere variant).
export const glass = 'rounded-3xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-xl'
export const glassSoft = 'rounded-2xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-md'

// Primaire actie met glow.
export const playPill =
  'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-brand px-4 py-2 text-sm font-extrabold text-white shadow-[0_10px_30px_-8px_rgba(29,158,117,0.85)]'
