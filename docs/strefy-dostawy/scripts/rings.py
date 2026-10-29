import json, math, re, sys, statistics, collections
src, out = sys.argv[1], sys.argv[2]
LAT, LON = 50.1058403, 20.0464376
def dist(lat, lon):
    r = 6371.0
    p1, p2 = math.radians(LAT), math.radians(lat)
    dp, dl = p2 - p1, math.radians(lon - LON)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(a))
data = json.load(open(src))
codes = collections.defaultdict(list)
places = collections.defaultdict(collections.Counter)
bad = collections.Counter()
for el in data["elements"]:
    t = el.get("tags", {})
    pc = t.get("addr:postcode", "").strip()
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lon = el.get("lon") or el.get("center", {}).get("lon")
    if lat is None: continue
    for c in re.split(r"[;,]\s*", pc):
        if not re.fullmatch(r"\d{2}-\d{3}", c):
            bad[c] += 1; continue
        codes[c].append(dist(lat, lon))
        places[c][t.get("addr:city") or t.get("addr:place") or "?"] += 1
rows = []
for c, ds in codes.items():
    ds.sort()
    n = len(ds)
    share5 = sum(d <= 5 for d in ds)/n
    share10 = sum(d <= 10 for d in ds)/n
    rows.append(dict(code=c, n=n, min=ds[0], med=statistics.median(ds), max=ds[-1],
                     share5=share5, share10=share10,
                     place=", ".join(p for p, _ in places[c].most_common(2))))
json.dump(dict(rows=rows, bad=bad.most_common(20)), open(out, "w"), ensure_ascii=False)
print(len(data["elements"]), "elements;", len(rows), "codes; bad", sum(bad.values()))
