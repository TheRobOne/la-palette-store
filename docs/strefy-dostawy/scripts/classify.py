import json, sys, csv
src, outdir = sys.argv[1], sys.argv[2]
rows = [r for r in json.load(open(src))["rows"] if r["min"] <= 10]
A, B, check, out = [], [], [], []
for r in rows:
    if r["n"] < 3:
        r["decision"] = "pominięty: <3 adresy w OSM (możliwy błąd), sprawdzić ręcznie"
        check.append(r); continue
    if r["share5"] >= 0.5:
        r["decision"] = "do 5 km"
        if r["share5"] < 0.8: r["decision"] += " (GRANICA: część adresów dalej)"
        A.append(r)
    elif r["share10"] >= 0.5:
        r["decision"] = "5–10 km"
        if r["share5"] > 0.2: r["decision"] += " (GRANICA: część adresów bliżej niż 5 km)"
        if r["share10"] < 0.8: r["decision"] += " (GRANICA: część adresów dalej niż 10 km)"
        B.append(r)
    else:
        r["decision"] = "poza 10 km (większość adresów dalej)"
        if r["share10"] > 0.2: r["decision"] += " (GRANICA)"
        out.append(r)
key = lambda r: r["code"]
open(f"{outdir}/strefa-do-5km.txt", "w").write("\n".join(r["code"] for r in sorted(A, key=key)) + "\n")
open(f"{outdir}/strefa-5-10km.txt", "w").write("\n".join(r["code"] for r in sorted(B, key=key)) + "\n")
with open(f"{outdir}/raport-kodow.csv", "w", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["kod", "decyzja", "adresow_w_OSM", "min_km", "mediana_km", "max_km", "udzial_do_5km", "udzial_do_10km", "miejscowosc"])
    for r in sorted(rows, key=key):
        w.writerow([r["code"], r["decision"], r["n"], f'{r["min"]:.1f}', f'{r["med"]:.1f}', f'{r["max"]:.1f}',
                    f'{r["share5"]:.0%}', f'{r["share10"]:.0%}', r["place"]])
flag = [r for r in rows if "GRANICA" in r["decision"]]
print("A", len(A), "B", len(B), "check", len(check), "out", len(out), "flagged", len(flag))
for r in sorted(flag, key=lambda r: r["decision"]):
    print(f'{r["code"]} {r["decision"]:58} n={r["n"]:5} {r["min"]:.1f}-{r["max"]:.1f} km s5={r["share5"]:.0%} s10={r["share10"]:.0%} {r["place"]}')
print("non-Kraków in A/B:", [(r["code"], r["decision"][:8]) for r in A+B if not r["code"].startswith(("30","31"))])
