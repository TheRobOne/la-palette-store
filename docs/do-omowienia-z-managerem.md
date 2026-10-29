# Do omówienia z managerem — sklep cateringowy

Stan na 27.10.2026. Sprawy, które wymagają decyzji biznesowej albo akceptacji treści. Przy każdej
jest miejsce na decyzję; po rozmowie wpisujemy ją tutaj i przenosimy do kodu lub specyfikacji.

Plik jest aktualizowany przy każdej implementacji (zasada w `AGENTS.md`, „Open business
questions”): nowe pytania dochodzą, a rozstrzygnięte i wdrożone znikają.

## 1. Maile do klientów i obsługi (spec 006)

### 1.1 Zwrot pieniędzy przy anulowaniu zamówienia przez obsługę

Mail „Zamówienie nr … zostało anulowane” zawiera dziś zdanie:

> Jeśli zamówienie było opłacone, zwrócimy pieniądze tą samą metodą płatności, najpóźniej
> w ciągu 14 dni.

Do ustalenia:

- czy obiecujemy pełny zwrot zawsze, gdy anuluje restauracja (np. awaria, brak produktu)?
- termin zwrotu: 14 dni czy szybciej? Kto i jak robi zwrot (panel płatności, przelew ręczny)?
- czy mail ma podawać powód anulowania (np. pole „powód” wpisywane przez obsługę)?

**Decyzja:** …

### 1.2 Przegląd treści wszystkich maili

Wszystkie teksty są po polsku i napisane przez nas — potrzebna akceptacja tonu i treści.
Szczególnie:

- **Potwierdzenie zamówienia** — to prawne potwierdzenie zawarcia umowy. Zawiera zdanie:
  „Żywność przygotowywana na wskazany termin nie podlega zwrotowi (art. 38 pkt 4 ustawy
  o prawach konsumenta).” Do potwierdzenia (najlepiej z prawnikiem) razem z regulaminem.
- **Zapytania o termin**: przyjęte / potwierdzone (z linkiem do płatności) / odrzucone /
  wygasło / anulowane za brak płatności.
- **Zmiana terminu odbioru przez obsługę** — dziś: „Jeśli nowy termin Ci nie odpowiada, odpowiedz
  na tę wiadomość albo zadzwoń.” Do ustalenia: co, jeśli klientowi nowy termin nie pasuje — czy
  przysługuje anulowanie ze zwrotem?
- **Przypomnienie dzień przed odbiorem** (wysyłane od 8:00) — czy ta godzina pasuje?

**Decyzja:** …

### 1.3 Nadawca i skrzynki

- Nadawca maili: „La Palette Garden – Catering” `catering@lapalettegarden.pl`; odpowiedzi
  klientów trafiają do skrzynki biuro@ (alias w Google Workspace). Czy nazwa nadawcy pasuje?
- Kto czyta maile z `catering@`? Jedna osoba (alias) czy kilka (grupa Google — też darmowa)?
- Adres, na który idą maile do obsługi (nowe zamówienie, nowe zapytanie, przypomnienie):
  biuro@ czy catering@?
- Przypomnienie dla obsługi o zapytaniu bez decyzji: domyślnie **4 h** przed wygaśnięciem — OK?

**Decyzja:** …

## 2. Warunki publikacji sklepu (blokują start)

- **Katalog**: teksty, ceny i część zdjęć to dziś kopia z megustacatering.pl — potrzebne własne
  opisy, ceny i zdjęcia La Palette.
- **Alergeny**: informacja o alergenach musi być dostępna przed zakupem (rozporządzenie UE
  1169/2011). Kto przygotuje listę alergenów dla każdego produktu?
- **Regulamin sklepu**: dziś zaślepka z polami „[do uzupełnienia]” — potrzebna pełna treść
  (sprzedawca, płatności, odbiór, reklamacje, brak prawa odstąpienia dla żywności na termin).
- **Płatności**: dziś płatność testowa; do startu Przelewy24 — konto firmowe w P24 i dane
  do integracji.
- **Landing `/catering`**: opinie i statystyki to szablon — prawdziwe opinie/zdjęcia realizacji
  albo usunięcie tych sekcji.

**Decyzja / odpowiedzialni:** …

## 3. Zasady przyjmowania zamówień (ustawiane w panelu, bez programisty)

Obecne wartości domyślne — do potwierdzenia:

| Ustawienie | Dziś | Decyzja |
|---|---|---|
| Minimalna wartość zamówienia | 100 zł | … |
| Dzienny limit zamówień kuchni | 10 | … |
| Wymagane wyprzedzenie zamówienia | 48 h | … |
| Jak daleko w przód można zamawiać | 60 dni | … |
| Okna odbioru | wt.–niedz., co godzinę 10:00–18:00 | … |
| Poniedziałki | zamknięte | otworzyć? standardowo czy „na zapytanie”? |

### Terminy „na zapytanie” (np. dni, w które kuchnia normalnie nie pracuje)

| Ustawienie | Dziś | Decyzja |
|---|---|---|
| Które dni/okna są „na zapytanie” | żadne | … |
| Wyprzedzenie dla zapytań | 72 h | … |
| Czas kuchni na odpowiedź | 24 h | … |
| Czas klienta na płatność po potwierdzeniu | 24 h | … |

### Zablokowane dni i okresy

Obsługa może zablokować pojedynczy dzień albo cały okres (np. cały maj) w Ustawienia →
Harmonogram odbiorów. Istniejące zamówienia zostają bez zmian. Czy są już znane terminy do
zablokowania (wesela, urlopy, święta)?

**Decyzja:** …

## 4. Dostawa (spec 007)

Ustalone 27.10.2026: dostawa jest od startu, obok odbioru osobistego. Strefy to **listy pełnych
kodów pocztowych** (XX-XXX); kod spoza wszystkich stref idzie „na zapytanie” — kuchnia
potwierdza i podaje koszt dostawy albo odrzuca. Dowozi własny kierowca, z limitem dostaw na
jedno okno. Darmowa dostawa od kwoty — jeden próg dla wszystkich stref, na start wyłączony.
Zapytania spoza stref przyjmujemy z całej Polski.

### 4.1 Strefy, kody i ceny

- Ile stref i jakie ceny? Na testy są dwie przykładowe: Strefa 1 (okolice lokalu, też kody spoza
  Krakowa, np. Niepołomice, Wieliczka) — 30 zł, Strefa 2 (reszta Krakowa) — 50 zł. Na produkcji
  przykładowych stref nie ma, a dostawa startuje **wyłączona**: obsługa wpisuje prawdziwe strefy
  i dopiero wtedy włącza dostawę w Harmonogramie.
- **Listy kodów**: w Krakowie kody są przypisane do ulic, więc strefa „do 10 km” to kilkaset
  kodów. Propozycja: przygotujemy listy z oficjalnego spisu kodów Poczty Polskiej po dzielnicach
  Krakowa i gminach wokół lokalu; manager/kuchnia przeglądają i zatwierdzają, obsługa wkleja je
  w panelu. Prostszy start: Strefa 1 = najbliższe okolice, Strefa 2 = cały Kraków, reszta na
  zapytanie. Który wariant?
- **Gotowa propozycja z OpenStreetMap**: pierścienie do 5 km (182 kody) i 5–10 km (438 kodów)
  wokół lokalu, z raportem kodów granicznych — [strefy-dostawy/](strefy-dostawy/README.md).
  Do decyzji: wiejskie kody 32-010, 32-091, 32-086, 32-087 obejmują całe gminy (bliskie
  Raciborowice i dalekie wsie mają ten sam kod), więc są w całości w strefie 5–10 km.
- Czy któraś strefa ma wyższą minimalną wartość zamówienia niż 100 zł?

| Ustawienie | Domyślnie | Decyzja |
|---|---|---|
| Strefy i ceny | 2 przykładowe (30 zł / 50 zł) | … |
| Minimum dla strefy | brak (obowiązuje 100 zł) | … |
| Darmowa dostawa od kwoty | wyłączona | … |
| Maks. dostaw w jednym oknie (kierowca) | 2 | … |
| Okna dostaw | dni jak odbiory, co 2 h 10:00–18:00 | … |
| Wyprzedzenie dla dostawy | 48 h | … |

### 4.2 Treści dla klienta

- Komunikat dla adresu spoza stref (sklep, przed wysłaniem): „Dostawa pod ten adres wymaga
  potwierdzenia kuchni. Koszt dostawy podamy razem z potwierdzeniem, płacisz dopiero po nim.”
- Maile dla dostaw (spec 007, `contracts/emails.md`) — m.in. przypomnienie „Jutro dostawa
  zamówienia nr …” z tekstem „kierowca zadzwoni pod numer …”. Do akceptacji jak pozostałe maile
  (pkt 1.2).
- Teksty wdrożone w backendzie (do akceptacji; zmiana = jedna linijka w podanym pliku):
  - błędy przy płatności (`apps/backend/src/lib/delivery-checks.ts`): „Uzupełnij adres dostawy:
    ulica i numer, kod pocztowy, miejscowość, telefon.”, „Podaj poprawny kod pocztowy (XX-XXX).”,
    „Wybierz ponownie sposób odbioru lub dostawy.”, „Koszt dostawy się zmienił — sprawdź koszyk
    i spróbuj ponownie.”, „Minimalna wartość zamówienia z dostawą pod ten adres to … Dodaj
    produkty za co najmniej ….”, „Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij
    zapytanie.”;
  - zajęte okno (`apps/backend/src/modules/catering/scheduling/term.ts`): „Wybrany termin dostawy
    (…) nie jest już dostępny. Wybierz inny termin.”;
  - tematy maili (`apps/backend/src/lib/emails/templates/`): „Otrzymaliśmy zapytanie o dostawę
    …”, „Kuchnia potwierdziła dostawę … — zapłać do …”, „Zapytanie o dostawę … wygasło”, „Zmiana
    terminu dostawy: …”, „Jutro dostawa zamówienia nr …”; w treści „Koszt dostawy podamy razem
    z potwierdzeniem.” i „Kierowca zadzwoni pod numer …”.
- Dostawa obejmuje tylko dowiezienie — bez rozstawiania bufetu i odbioru naczyń. Czy to
  zgodne z ofertą? Jeśli naczynia/sprzęt wracają, trzeba to opisać w regulaminie.

**Decyzja:** …

## 5. Na później (bez pilności)

- **Konta klientów** (historia zamówień, ponowne zamówienie, zapamiętane dane do faktury) —
  proponujemy dopiero po starcie, gdy pojawią się stali klienci firmowi. Czy są tacy już teraz?

**Decyzja:** …
