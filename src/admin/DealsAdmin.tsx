import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LINES, LINE_IDS, STOPS } from '../lib/schedule'
import { dealWeekWindow, mondayOf } from '../lib/time'

/**
 * Pontdeals beheren: partners aanmaken, ze een pincode geven, en per week één
 * deal inplannen.
 *
 * Bewust een lijst en een formulier, geen kalender of sleepbare planning. Er
 * is één deal per week; dat is te overzien met twee velden en een knop.
 */

interface PartnerRow {
  id: string
  slug: string
  name: string
  logo_url: string | null
  address: string | null
  has_pin: boolean
  locked_until: string | null
}

interface DealRow {
  id: string
  partner_id: string
  partner_name: string
  partner_slug: string
  offer: string
  stop_id: string
  lines: string[]
  walk_min: number | null
  valid_from: string
  valid_to: string
  status: string
  codes: number
  redeemed: number
}

/** De steigers waar een lijn aanlegt, zodat "lijnen" bij "steiger" past. */
export function linesForStop(stopId: string): string[] {
  return LINE_IDS.filter((l) => (LINES[l]?.connects ?? []).includes(stopId))
}

const leeg = {
  id: null as string | null,
  partner_id: '',
  offer: '',
  stop_id: '',
  walk_min: '',
  monday: '',
  status: 'concept',
}

export function DealsAdmin() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [form, setForm] = useState({ ...leeg, monday: mondayOf() })
  const [melding, setMelding] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [nieuwePartner, setNieuwePartner] = useState({ name: '', slug: '', address: '' })

  const laden = useCallback(async () => {
    if (!supabase) return
    const [p, d] = await Promise.all([
      supabase.rpc('admin_list_partners'),
      supabase.rpc('admin_list_deals'),
    ])
    setPartners((p.data as PartnerRow[]) ?? [])
    setDeals((d.data as DealRow[]) ?? [])
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  const bewaarDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || bezig) return
    const venster = dealWeekWindow(form.monday)
    if (!venster) {
      setMelding('Die maandag kan ik niet omrekenen.')
      return
    }
    setBezig(true)
    const { error } = await supabase.rpc('admin_save_deal', {
      p_id: form.id,
      p_partner: form.partner_id,
      p_offer: form.offer,
      p_stop: form.stop_id,
      p_lines: linesForStop(form.stop_id),
      p_walk_min: form.walk_min === '' ? null : Number(form.walk_min),
      p_valid_from: venster.from,
      p_valid_to: venster.to,
      p_status: form.status,
    })
    setBezig(false)
    setMelding(error ? error.message : form.id ? 'Deal bijgewerkt.' : 'Deal aangemaakt.')
    if (!error) {
      setForm({ ...leeg, monday: mondayOf() })
      void laden()
    }
  }

  const bewerk = (d: DealRow) =>
    setForm({
      id: d.id,
      partner_id: d.partner_id,
      offer: d.offer,
      stop_id: d.stop_id,
      walk_min: d.walk_min == null ? '' : String(d.walk_min),
      monday: mondayOf(new Date(d.valid_from)),
      status: d.status,
    })

  const zetStatus = async (d: DealRow, status: string) => {
    if (!supabase) return
    await supabase.rpc('admin_save_deal', {
      p_id: d.id,
      p_partner: d.partner_id,
      p_offer: d.offer,
      p_stop: d.stop_id,
      p_lines: d.lines,
      p_walk_min: d.walk_min,
      p_valid_from: d.valid_from,
      p_valid_to: d.valid_to,
      p_status: status,
    })
    void laden()
  }

  const maakPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const { error } = await supabase.rpc('admin_save_partner', {
      p_id: null,
      p_slug: nieuwePartner.slug || nieuwePartner.name,
      p_name: nieuwePartner.name,
      p_logo_url: null,
      p_address: nieuwePartner.address || null,
      p_lat: null,
      p_lng: null,
    })
    setMelding(error ? error.message : 'Partner aangemaakt.')
    if (!error) {
      setNieuwePartner({ name: '', slug: '', address: '' })
      void laden()
    }
  }

  const zetPin = async (p: PartnerRow) => {
    if (!supabase) return
    const pin = window.prompt(`Pincode voor ${p.name} (vier cijfers)`)
    if (!pin) return
    const { error } = await supabase.rpc('admin_set_partner_pin', { p_id: p.id, p_pin: pin })
    setMelding(
      error ? error.message : `Pincode gezet. Geef ${p.name} de link /partner/${p.slug} en de code.`,
    )
    void laden()
  }

  const veld = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm'
  const stops = Object.keys(STOPS)

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Kaart titel="Pontdeal inplannen" emoji="🍕">
        <form onSubmit={bewaarDeal} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">
              Partner
              <select
                required
                value={form.partner_id}
                onChange={(e) => setForm({ ...form, partner_id: e.target.value })}
                className={veld}
              >
                <option value="">Kies een partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Steiger
              <select
                required
                value={form.stop_id}
                onChange={(e) => setForm({ ...form, stop_id: e.target.value })}
                className={veld}
              >
                <option value="">Kies een steiger</option>
                {stops.map((s) => (
                  <option key={s} value={s}>
                    {STOPS[s].name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs font-semibold text-slate-500">
            Aanbod (maximaal zes woorden)
            <input
              required
              value={form.offer}
              onChange={(e) => setForm({ ...form, offer: e.target.value })}
              placeholder="Pizza margherita 9 euro in plaats van 14"
              className={veld}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">
              Looptijd vanaf de steiger (min)
              <input
                type="number"
                min={1}
                max={30}
                value={form.walk_min}
                onChange={(e) => setForm({ ...form, walk_min: e.target.value })}
                className={veld}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Week (maandag)
              <input
                type="date"
                required
                value={form.monday}
                onChange={(e) => setForm({ ...form, monday: e.target.value })}
                className={veld}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={veld}
              >
                <option value="concept">concept</option>
                <option value="actief">actief</option>
                <option value="gestopt">gestopt</option>
              </select>
            </label>
          </div>

          <p className="text-[11px] text-slate-400">
            {form.stop_id
              ? `Zichtbaar voor wie op ${linesForStop(form.stop_id).join(', ') || 'geen lijn'} wacht, van maandag 00:00 tot en met woensdag 23:59.`
              : 'Kies een steiger; de lijnen die daar aanleggen vullen zichzelf in.'}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={bezig}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {form.id ? 'Bijwerken' : 'Aanmaken'}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm({ ...leeg, monday: mondayOf() })}
                className="text-sm text-slate-400 underline-offset-2 hover:underline"
              >
                Nieuw
              </button>
            )}
            {melding && <span className="text-xs text-slate-500">{melding}</span>}
          </div>
        </form>
      </Kaart>

      <Kaart titel="Ingeplande deals" emoji="🗓">
        {deals.length === 0 ? (
          <p className="text-sm text-slate-400">Nog geen deals.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-1 font-semibold">Week</th>
                  <th className="font-semibold">Partner</th>
                  <th className="font-semibold">Aanbod</th>
                  <th className="font-semibold">Steiger</th>
                  <th className="font-semibold">Codes</th>
                  <th className="font-semibold">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-1.5 text-slate-500">
                      {new Date(d.valid_from).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="text-slate-700">{d.partner_name}</td>
                    <td className="max-w-40 truncate text-slate-700">{d.offer}</td>
                    <td className="text-slate-500">{STOPS[d.stop_id]?.name ?? d.stop_id}</td>
                    <td className="tabular-nums text-slate-600">
                      {d.redeemed} / {d.codes}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          d.status === 'actief'
                            ? 'bg-emerald-100 text-emerald-700'
                            : d.status === 'gestopt'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" onClick={() => bewerk(d)} className="text-xs text-slate-500 underline-offset-2 hover:underline">
                        bewerk
                      </button>
                      {d.status !== 'actief' ? (
                        <button type="button" onClick={() => zetStatus(d, 'actief')} className="ml-2 text-xs font-semibold text-emerald-600">
                          activeer
                        </button>
                      ) : (
                        <button type="button" onClick={() => zetStatus(d, 'gestopt')} className="ml-2 text-xs text-slate-400">
                          stop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kaart>

      <Kaart titel="Partners" emoji="🤝">
        <form onSubmit={maakPartner} className="mb-4 grid gap-2 sm:grid-cols-4">
          <input
            required
            placeholder="Naam"
            value={nieuwePartner.name}
            onChange={(e) => setNieuwePartner({ ...nieuwePartner, name: e.target.value })}
            className={veld}
          />
          <input
            placeholder="slug (optioneel)"
            value={nieuwePartner.slug}
            onChange={(e) => setNieuwePartner({ ...nieuwePartner, slug: e.target.value })}
            className={veld}
          />
          <input
            placeholder="Adres"
            value={nieuwePartner.address}
            onChange={(e) => setNieuwePartner({ ...nieuwePartner, address: e.target.value })}
            className={veld}
          />
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Partner toevoegen
          </button>
        </form>
        {partners.length === 0 ? (
          <p className="text-sm text-slate-400">Nog geen partners.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {partners.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
                <span className="text-slate-700">
                  {p.name} <span className="text-slate-400">/partner/{p.slug}</span>
                </span>
                <span className="flex items-center gap-3">
                  {p.locked_until && new Date(p.locked_until) > new Date() && (
                    <span className="text-xs font-semibold text-rose-600">op slot</span>
                  )}
                  <span className={`text-xs ${p.has_pin ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {p.has_pin ? 'pincode ingesteld' : 'nog geen pincode'}
                  </span>
                  <button type="button" onClick={() => zetPin(p)} className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline">
                    pincode zetten
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Kaart>
    </div>
  )
}

function Kaart({ titel, emoji, children }: { titel: string; emoji: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-sm font-bold text-slate-800">
        <span aria-hidden="true">{emoji}</span> {titel}
      </h3>
      {children}
    </section>
  )
}
