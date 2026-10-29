# Strefy dostawy — kody pocztowe

Docelowe strefy wokół lokalu (ul. Gustawa Morcinka 40, Kraków), wygenerowane 29.10.2026
z OpenStreetMap: **„Strefa 1 (do 5 km)” — 30 zł** i **„Strefa 2 (5–10 km)” — 50 zł**. Sklep
zakłada je przy pierwszym uruchomieniu w każdym środowisku (dane:
`apps/backend/src/scripts/data/delivery-zones.ts`, wygenerowane z plików poniżej). Potem to dane
w Adminie (Ustawienia → Strefy dostawy) — zmiany robi obsługa, a te pliki nie są wczytywane
ponownie.

| Plik | Zawartość |
|---|---|
| `strefa-do-5km.txt` | 182 kody, jeden w linii — do wklejenia w pole „Kody pocztowe” |
| `strefa-5-10km.txt` | 437 kodów, jak wyżej |
| `raport-kodow.csv` | każdy kod z adresami do 10 km: decyzja, liczba adresów w OSM, odległość min / mediana / max, udział adresów do 5 i do 10 km, miejscowość (separator `;`) |

## Metoda

- Wszystkie adresy z `addr:postcode` w promieniu 20 km od lokalu (50.1058403, 20.0464376),
  ok. 134 tys. — Overpass API.
- Odległość w linii prostej od lokalu, liczona dla każdego adresu osobno.
- Kod trafia do strefy, w której leży **większość** jego adresów: do 5 km, jeśli ≥ 50% adresów
  jest do 5 km; 5–10 km, jeśli ≥ 50% jest do 10 km; inaczej poza strefami.
- „GRANICA” w raporcie: kod, którego adresy w dużej części leżą po drugiej stronie granicy
  5 lub 10 km — do świadomej decyzji.
- Pominięte: kody z mniej niż 3 adresami w OSM (możliwe literówki; część to prawdopodobnie
  prawdziwe kody pojedynczych budynków, np. w Nowej Hucie) oraz ręcznie usunięte 33-332 i 32-067
  (kody z innych rejonów, błędnie wpisane w OSM) i 30-001 (zob. niżej).

## Ograniczenia

- **Wsie**: jeden kod obejmuje gminę lub jej dużą część — 32-010 (Kocmyrzów-Luborzyca, adresy
  0,5–12,9 km), 32-091 (Michałowice), 32-086 (Węgrzce, Batowice, Dziekanowice), 32-087
  (Zielonki, Bibice). Wszystkie są w strefie 5–10 km, także bliskie wsie jak Raciborowice czy
  Zastów (ok. 2 km).
- **Linia prosta**, nie trasa przejazdu (dłuższa np. przez Wisłę).
- Adres, którego kodu nie ma na żadnej liście, idzie „na zapytanie” — kuchnia potwierdza
  i podaje koszt, więc braki nie powodują strat.
- 30-001 jest w OSM rozrzucony po całym mieście (3–18 km), więc go usunięto.

## Odtworzenie

```sh
# 1. dane (ok. 45 MB, nie trzymamy w repo); zapytanie Overpass QL:
#    [out:json][timeout:280];
#    (nwr["addr:postcode"~"^3[0-3]-"](around:20000,50.1058403,20.0464376););
#    out center tags qt;
curl -s --data-urlencode 'data=<zapytanie wyżej>' https://overpass-api.de/api/interpreter -o osm20.json
# 2. statystyki per kod, 3. podział na strefy (zapisuje pliki w katalogu docelowym)
python3 -I scripts/rings.py osm20.json codes20.json
python3 -I scripts/classify.py codes20.json <katalog>
# 4. usunąć ręcznie 33-332, 32-067 i 30-001 (zob. wyżej), potem zaktualizować
#    apps/backend/src/scripts/data/delivery-zones.ts (dotyczy tylko nowych baz)
```

Dane: © OpenStreetMap contributors, ODbL 1.0.
