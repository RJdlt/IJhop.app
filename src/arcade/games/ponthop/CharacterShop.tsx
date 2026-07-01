import { useState } from 'react'
import { useI18n } from '../../../i18n/i18n'
import { track } from '../../../lib/analytics'
import {
  CHARACTERS,
  buyCharacter,
  canAfford,
  isUnlocked,
  levelProgress,
  loadProfile,
  saveProfile,
  selectCharacter,
  type Character,
  type Profile,
} from './profile'

/**
 * Poppetjes-shop: kies een vrijgespeeld poppetje of koop er één met gespaarde
 * stroopwafels. Toont ook de spaarpot en het persistente spelerniveau.
 * Wordt door de arcade-shell op het menu gerenderd (game-eigen paneel).
 */
export function CharacterShop() {
  const { t, lang } = useI18n()
  const [profile, setProfile] = useState<Profile>(() => loadProfile())

  const commit = (next: Profile) => {
    saveProfile(next)
    setProfile(next)
  }

  interface Card {
    char: Character
    unlocked: boolean
    selected: boolean
    buyable: boolean
  }

  const onPick = (card: Card) => {
    if (card.selected) return
    if (card.unlocked) {
      commit(selectCharacter(profile, card.char.id))
      track('character_select', { id: card.char.id })
    } else if (card.buyable) {
      commit(buyCharacter(profile, card.char.id))
      track('character_buy', { id: card.char.id })
    }
  }

  const statusLabel = (card: Card): string => {
    if (card.selected) return `✓ ${t.arcade.chosen}`
    if (card.unlocked) return t.arcade.choose
    const u = card.char.unlock
    if (u.type === 'shop') return `🧇 ${u.cost}`
    if (u.type === 'milestone') return `🔒 ${u.crossings}×`
    return t.arcade.choose // 'free' is altijd vrij; onbereikbaar
  }

  const cards: Card[] = CHARACTERS.map((c) => {
    const unlocked = isUnlocked(profile, c)
    return {
      char: c,
      unlocked,
      selected: profile.selected === c.id,
      buyable: !unlocked && canAfford(profile, c),
    }
  })

  const prog = levelProgress(profile.totalCrossings)

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/[0.06] p-3.5 text-left ring-1 ring-white/10 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          {t.arcade.shopTitle}
        </p>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold tabular-nums">
          🧇 {profile.wallet}
        </span>
      </div>

      {/* Persistent spelerniveau met voortgangsbalkje */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>
            {t.arcade.playerLevel} {prog.level}
          </span>
          <span className="tabular-nums">
            {prog.intoLevel}/{prog.span}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400"
            style={{ width: `${Math.min(100, (prog.intoLevel / prog.span) * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {cards.map((card) => {
          const { char, unlocked, selected, buyable } = card
          const tappable = !selected && (unlocked || buyable)
          return (
            <button
              key={char.id}
              type="button"
              disabled={!tappable}
              onClick={() => onPick(card)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center transition ${
                selected
                  ? 'border-amber-400 bg-amber-400/15'
                  : tappable
                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                    : 'border-white/5 bg-white/[0.03] opacity-60'
              }`}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-lg"
                style={{ backgroundColor: unlocked ? char.bodyColor : '#374151' }}
              >
                {char.emoji}
              </span>
              <span className="w-full truncate text-[11px] font-medium leading-tight">
                {char.name[lang]}
              </span>
              <span className="text-[10px] leading-none text-white/60">{statusLabel(card)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
