import { useState } from 'react'
import { useI18n } from '../../../i18n/i18n'
import { track } from '../../../lib/analytics'
import { getHighScore } from '../../scoreStore'
import { SKINS, isSkinUnlocked, loadSelectedSkin, saveSelectedSkin } from './skins'

/**
 * Pontskins-kiezer: puur cosmetisch, ontgrendeld via score-mijlpalen (de
 * bestaande high score voor dit spel). Wordt door de arcade-shell op het
 * menu gerenderd (game-eigen paneel), net als de poppetjes-shop van Pont Hop.
 */
export function SkinPicker() {
  const { t, lang } = useI18n()
  const [selected, setSelected] = useState(() => loadSelectedSkin())
  const best = getHighScore('oversteek')

  const onPick = (id: string, unlocked: boolean) => {
    if (!unlocked || id === selected) return
    setSelected(id)
    saveSelectedSkin(id)
    track('skin_select', { id })
  }

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/[0.06] p-3.5 text-left ring-1 ring-white/10">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
        {lang === 'nl' ? 'Pontskins' : 'Ferry skins'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SKINS.map((skin) => {
          const unlocked = isSkinUnlocked(skin, best)
          const isSel = selected === skin.id
          const tappable = unlocked && !isSel
          return (
            <button
              key={skin.id}
              type="button"
              disabled={!tappable}
              onClick={() => onPick(skin.id, unlocked)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center transition ${
                isSel
                  ? 'border-amber-400 bg-amber-400/15'
                  : tappable
                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                    : 'border-white/5 bg-white/[0.03] opacity-60'
              }`}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-lg"
                style={{ backgroundColor: unlocked ? skin.hull : '#374151' }}
              >
                ⛴️
              </span>
              <span className="w-full truncate text-[11px] font-medium leading-tight">{skin.name[lang]}</span>
              <span className="text-[10px] leading-none text-white/60">
                {isSel ? `✓ ${t.arcade.chosen}` : unlocked ? t.arcade.choose : `🔒 ${skin.unlockScore} pt`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
