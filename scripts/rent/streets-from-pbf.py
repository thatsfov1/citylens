# Named street points inside the Kraków box, from a Geofabrik extract: used to place rental listings on the hex grid
# (scripts/rent/build-osiedle.ts). Needs pyosmium (pip install osmium) and the extract:
#   curl -O https://download.geofabrik.de/europe/poland/malopolskie-latest.osm.pbf
#   python3 scripts/rent/streets-from-pbf.py malopolskie-latest.osm.pbf
# Writes data/rent/full/streets.json ({ "street name": [[lng, lat], ...] }, every 3rd node; gitignored, ~1.2 MB).
# Data © OpenStreetMap contributors, ODbL.
import json, os, sys
import osmium

SOUTH, WEST, NORTH, EAST = 49.95, 19.75, 50.15, 20.15  # same box as scripts/osm/fetch.ts
out = {}
fp = osmium.FileProcessor(sys.argv[1]).with_locations().with_filter(osmium.filter.KeyFilter("highway"))
for o in fp:
    if not o.is_way():
        continue
    name = o.tags.get("name")
    if not name:
        continue
    pts = [(round(n.lon, 5), round(n.lat, 5)) for n in o.nodes if n.location.valid()]
    pts = [p for p in pts if SOUTH <= p[1] <= NORTH and WEST <= p[0] <= EAST]
    if pts:
        out.setdefault(name, []).extend(pts[::3] or pts[:1])
os.makedirs("data/rent/full", exist_ok=True)
json.dump(out, open("data/rent/full/streets.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "streets,", sum(len(v) for v in out.values()), "points")
