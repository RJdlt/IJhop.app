#!/usr/bin/env python3
"""
Regenerate src/data/timetable.json from the official Dutch GTFS feed.

The app only needs the two IJ-ferry lines that cross between NDSM and the south
bank, so this script downloads the national GTFS, keeps just GVB lines F4 and
F7, and distils a *weekly recurring pattern* (one representative date per
weekday) into a compact JSON. That keeps the bundle tiny and the schedule
stable across the months a feed covers.

Usage:
    python3 scripts/generate-timetable.py

Re-run whenever GVB publishes a new timetable (e.g. seasonal changes).
"""
from __future__ import annotations

import csv
import datetime
import io
import json
import os
import sys
import urllib.request
import zipfile
from collections import defaultdict

GTFS_URL = "http://gtfs.ovapi.nl/nl/gtfs-nl.zip"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "timetable.json")

# GVB ferry route short names we care about and the stops they connect.
WANTED_LINES = {"F4", "F7"}
STOP_IDS = {  # GTFS stop_id -> our short key
    "3980786": "ndsm",
    "3980457": "centraal",
    "3980046": "pontsteiger",
}
STOP_NAMES = {"ndsm": "NDSM-werf", "centraal": "Centraal Station", "pontsteiger": "Pontsteiger"}
LINE_META = {
    "F4": {"connects": ["ndsm", "centraal"], "color": "#E2231A", "durationMin": 13},
    "F7": {"connects": ["ndsm", "pontsteiger"], "color": "#009DE0", "durationMin": 5},
}


def read_csv(zf: zipfile.ZipFile, name: str):
    with zf.open(name) as fh:
        yield from csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig"))


def to_minutes(t: str) -> int:
    h, m, _ = t.split(":")
    return int(h) * 60 + int(m)


def main() -> int:
    print(f"Downloading {GTFS_URL} (~240 MB)…", file=sys.stderr)
    data = urllib.request.urlopen(GTFS_URL, timeout=600).read()
    zf = zipfile.ZipFile(io.BytesIO(data))

    # routes -> ferry route_ids
    route_line = {
        r["route_id"]: r["route_short_name"]
        for r in read_csv(zf, "routes.txt")
        if r.get("agency_id") == "GVB"
        and r.get("route_type") == "4"
        and r["route_short_name"] in WANTED_LINES
    }

    # trips on those routes
    trips = {}
    ferry_services = set()
    for r in read_csv(zf, "trips.txt"):
        if r["route_id"] in route_line:
            trips[r["trip_id"]] = {"line": route_line[r["route_id"]], "svc": r["service_id"]}
            ferry_services.add(r["service_id"])
    trip_ids = set(trips)

    # stop_times for those trips (origin = seq 1, destination = seq 2)
    st = defaultdict(dict)
    for r in read_csv(zf, "stop_times.txt"):
        if r["trip_id"] in trip_ids:
            st[r["trip_id"]][int(r["stop_sequence"])] = (
                r["stop_id"],
                to_minutes(r["arrival_time"]),
                to_minutes(r["departure_time"]),
            )

    # service_id -> active dates (this feed uses calendar_dates only)
    svc_dates = defaultdict(set)
    for r in read_csv(zf, "calendar_dates.txt"):
        if r["service_id"] in ferry_services and r["exception_type"] == "1":
            svc_dates[r["service_id"]].add(r["date"])

    # pick the first full Mon–Sun week that every weekday can be represented in
    all_dates = sorted({d for ds in svc_dates.values() for d in ds})
    start = datetime.datetime.strptime(all_dates[0], "%Y%m%d").date()
    monday = start + datetime.timedelta(days=(7 - start.weekday()) % 7)
    rep = {wd: (monday + datetime.timedelta(days=wd)).strftime("%Y%m%d") for wd in range(7)}

    schedule = {}
    for wd, date in rep.items():
        active = {s for s in ferry_services if date in svc_dates.get(s, ())}
        deps = []
        for tid, t in trips.items():
            if t["svc"] not in active:
                continue
            stops = st.get(tid)
            if not stops or 1 not in stops or 2 not in stops:
                continue
            o_sid, _, o_dep = stops[1]
            d_sid, d_arr, _ = stops[2]
            origin, dest = STOP_IDS.get(o_sid), STOP_IDS.get(d_sid)
            if not origin or not dest:
                continue
            deps.append(
                {
                    "line": t["line"],
                    "from": origin,
                    "to": dest,
                    "m": o_dep,
                    "dep": f"{(o_dep % 1440) // 60:02d}:{(o_dep % 1440) % 60:02d}",
                    "dur": d_arr - o_dep,
                }
            )
        deps.sort(key=lambda x: (x["m"], x["from"], x["line"]))
        schedule[str(wd)] = deps

    stop_meta = {}
    stops_seen = {r["stop_id"]: r for r in read_csv(zf, "stops.txt") if r["stop_id"] in STOP_IDS}
    for sid, key in STOP_IDS.items():
        r = stops_seen[sid]
        stop_meta[key] = {
            "gtfsId": sid,
            "name": STOP_NAMES[key],
            "lat": float(r["stop_lat"]),
            "lon": float(r["stop_lon"]),
        }

    out = {
        "source": "GVB GTFS (gtfs.ovapi.nl/nl)",
        "generated": datetime.date.today().isoformat(),
        "note": "Weekly recurring pattern. m = minutes since midnight of service day "
        "(can exceed 1440 for after-midnight sailings; real minute-of-week = weekday*1440 + m).",
        "timezone": "Europe/Amsterdam",
        "stops": stop_meta,
        "lines": {ln: {"name": ln, **LINE_META[ln]} for ln in WANTED_LINES},
        "schedule": schedule,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(v) for v in schedule.values())
    print(f"Wrote {os.path.relpath(OUT)} — {total} sailings across the week.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
