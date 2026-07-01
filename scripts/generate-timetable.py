#!/usr/bin/env python3
"""
Regenerate src/data/timetable.json from the official Dutch GTFS feed.

Keeps every GVB ferry line that runs *within Amsterdam* (both stops in Amsterdam),
so F1, F2, F3, F4, F6, F7 and F9, and distils a weekly recurring pattern (one
representative date per weekday) into a compact JSON. Stops outside Amsterdam
(e.g. Zaandam, Assendelft, Velsen ferries) are left out on purpose.

Usage:
    python3 scripts/generate-timetable.py

Re-run whenever GVB publishes a new timetable (e.g. seasonal changes).
"""
from __future__ import annotations
import csv, io, json, os, re, sys, datetime, urllib.request, zipfile
from collections import defaultdict

GTFS_URL = "https://gtfs.ovapi.nl/nl/gtfs-nl.zip"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "timetable.json")

# Curated, distinct colours per line (F4 red, F7 blue as the app has always shown).
LINE_COLOR = {
    "F1": "#1D9E75", "F2": "#00A0C6", "F3": "#F08A24", "F4": "#E2231A",
    "F6": "#E8909A", "F7": "#009DE0", "F9": "#7C3AED",
}


def rows(zf: zipfile.ZipFile, name: str):
    with zf.open(name) as fh:
        yield from csv.reader(io.TextIOWrapper(fh, encoding="utf-8-sig"))


def to_minutes(t: str) -> int:
    h, m, _ = t.split(":")
    return int(h) * 60 + int(m)


def slug(name: str) -> str:
    s = name.lower()
    for a, b in [("é", "e"), ("è", "e"), ("ï", "i"), ("ë", "e"), ("ö", "o"), ("ü", "u"), ("á", "a")]:
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s[9:] if s.startswith("amsterdam") else s


def col(header):
    return {c: i for i, c in enumerate(header)}


def main() -> int:
    print(f"Downloading {GTFS_URL} (~225 MB)…", file=sys.stderr)
    zf = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(GTFS_URL, timeout=900).read()))

    it = rows(zf, "routes.txt"); H = col(next(it))
    routes = {
        r[H["route_id"]]: r[H["route_short_name"]]
        for r in it
        if r[H["route_type"]] == "4" and "agency_id" in H and r[H["agency_id"]] == "GVB"
    }
    it = rows(zf, "trips.txt"); H = col(next(it))
    trips, svcs = {}, set()
    for r in it:
        rid = r[H["route_id"]]
        if rid in routes:
            trips[r[H["trip_id"]]] = {"line": routes[rid], "svc": r[H["service_id"]]}
            svcs.add(r[H["service_id"]])
    trip_ids = set(trips)

    print("Scanning stop_times…", file=sys.stderr)
    seqs = defaultdict(list)
    it = rows(zf, "stop_times.txt"); H = col(next(it))
    ti, ss, si, ai, di = H["trip_id"], H["stop_sequence"], H["stop_id"], H["arrival_time"], H["departure_time"]
    for r in it:
        if r[ti] in trip_ids:
            seqs[r[ti]].append((int(r[ss]), r[si], to_minutes(r[ai]), to_minutes(r[di])))
    trip_od, used = {}, set()
    for tid, rs in seqs.items():
        rs.sort()
        trip_od[tid] = (rs[0][1], rs[0][3], rs[-1][1], rs[-1][2])
        used.add(rs[0][1]); used.add(rs[-1][1])

    it = rows(zf, "stops.txt"); H = col(next(it))
    info = {}
    for r in it:
        if r[H["stop_id"]] in used:
            info[r[H["stop_id"]]] = {"name": r[H["stop_name"]], "lat": float(r[H["stop_lat"]]), "lon": float(r[H["stop_lon"]])}
    is_ams = lambda sid: info[sid]["name"].startswith("Amsterdam")
    disp = lambda sid: info[sid]["name"].replace("Amsterdam, ", "")
    key = {s: slug(info[s]["name"]) for s in used}

    it = rows(zf, "calendar_dates.txt"); H = col(next(it))
    svc_dates = defaultdict(set)
    for r in it:
        if r[H["service_id"]] in svcs and r[H["exception_type"]] == "1":
            svc_dates[r[H["service_id"]]].add(r[H["date"]])
    all_dates = sorted({d for ds in svc_dates.values() for d in ds})
    start = datetime.datetime.strptime(all_dates[0], "%Y%m%d").date()
    monday = start + datetime.timedelta(days=(7 - start.weekday()) % 7)
    rep = {wd: (monday + datetime.timedelta(days=wd)).strftime("%Y%m%d") for wd in range(7)}

    schedule, used_ams, lines_seen = {}, set(), set()
    for wd, date in rep.items():
        active = {s for s in svcs if date in svc_dates.get(s, ())}
        deps = []
        for tid, t in trips.items():
            if t["svc"] not in active:
                continue
            od = trip_od.get(tid)
            if not od:
                continue
            o_sid, o_dep, d_sid, d_arr = od
            if not (is_ams(o_sid) and is_ams(d_sid)):
                continue
            o, d = key[o_sid], key[d_sid]
            if o == d:
                continue
            used_ams.add(o_sid); used_ams.add(d_sid); lines_seen.add(t["line"])
            deps.append({"line": t["line"], "from": o, "to": d, "m": o_dep,
                         "dep": f"{(o_dep % 1440) // 60:02d}:{(o_dep % 1440) % 60:02d}", "dur": d_arr - o_dep})
        deps.sort(key=lambda x: (x["m"], x["from"], x["line"]))
        schedule[str(wd)] = deps

    pairs, durs = defaultdict(list), defaultdict(list)
    for wd in schedule.values():
        for d in wd:
            for s in (d["from"], d["to"]):
                if s not in pairs[d["line"]]:
                    pairs[d["line"]].append(s)
            durs[d["line"]].append(d["dur"])
    lines = {}
    for ln in sorted(lines_seen):
        ds = sorted(durs[ln]); md = ds[len(ds) // 2] if ds else 0
        lines[ln] = {"name": ln, "connects": pairs[ln][:2], "color": LINE_COLOR.get(ln, "#1D9E75"), "durationMin": md}

    stops_out = {key[s]: {"gtfsId": s, "name": disp(s), "lat": info[s]["lat"], "lon": info[s]["lon"]} for s in used_ams}
    out = {
        "source": "GVB GTFS (gtfs.ovapi.nl/nl)",
        "generated": datetime.date.today().isoformat(),
        "note": "Weekly recurring pattern. m = minutes since midnight of service day "
                "(can exceed 1440 for after-midnight sailings; real minute-of-week = weekday*1440 + m).",
        "timezone": "Europe/Amsterdam",
        "stops": stops_out, "lines": lines, "schedule": schedule,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(v) for v in schedule.values())
    print(f"Wrote {os.path.relpath(OUT)} — {len(lines)} lines, {len(stops_out)} stops, {total} sailings/week.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
