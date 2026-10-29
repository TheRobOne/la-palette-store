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

- **Ustalone 29.10.2026**: dwie strefy wokół lokalu, z OpenStreetMap — „Strefa 1 (do 5 km)”
  30 zł (182 kody) i „Strefa 2 (5–10 km)” 50 zł (437 kodów); dalej „na zapytanie”. Sklep
  zakłada je przy pierwszym uruchomieniu, także na produkcji, z dostawą od razu włączoną.
  Listy, metoda i raport kodów granicznych: [strefy-dostawy/](strefy-dostawy/README.md).
- Do wiadomości: wiejskie kody 32-010, 32-091, 32-086, 32-087 obejmują całe gminy (bliskie
  Raciborowice i dalekie wsie mają ten sam kod), więc są w całości w strefie 5–10 km. Kody
  graniczne i pominięte (mało adresów w OSM) obsługa może przenieść lub dopisać w panelu.
- Czy któraś strefa ma wyższą minimalną wartość zamówienia niż 100 zł?

| Ustawienie | Domyślnie | Decyzja |
|---|---|---|
| Strefy i ceny | do 5 km 30 zł / 5–10 km 50 zł | ustalone 29.10.2026 |
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

## 5. Kody rabatowe

Klient wpisuje kod w koszyku. Rabat widać w koszyku, w zamówieniu, na potwierdzeniu, w mailach
i na liście zapytań w panelu.

### Jak założyć kod (panel → Promocje → Utwórz)

1. Typ: **kwota stała na całe zamówienie** (np. 30 zł), waluta PLN. Kwota jest **brutto** — sklep
   sam włącza „Tax inclusive” przy zakładaniu; nie wyłączaj go (inaczej klient dostanie o VAT
   więcej, np. 32,40 zł zamiast 30 zł).
2. **Kod wielkimi literami**, bez spacji i polskich znaków, np. `WESELE30`. Klient może wpisać
   małymi — sklep zamieni na wielkie. Kod zapisany małymi literami nie zadziała.
3. Opcjonalnie: daty ważności i limit użyć (kampania / budżet).
4. Po zapisaniu, na stronie promocji, w ramce **„Minimalna wartość koszyka”** wpisz, od jakiej
   kwoty produktów (przed rabatem, bez dostawy) kod działa — **wyraźnie powyżej minimum
   zamówienia**, np. równowartość trzech boksów, gdy minimum to dwa. Ramka ostrzega, gdy kwota
   nie przekracza minimum. Tego warunku nie ma w standardowej sekcji „Warunki” panelu.
5. Status promocji: **aktywna**.

### Ustalone 29.10.2026

- **Zwykły kod na kwotę** (np. −30 zł od zamówienia). Bez osobnych kodów na dostawę.
- **Kod ustawiamy z minimalną kwotą wyraźnie wyższą niż minimum zamówienia.** Przykład: gdy
  minimum to równowartość dwóch boksów, kod działa dopiero od kwoty trzech boksów. Dzięki temu
  rabat nie zepchnie zamówienia poniżej minimum.
- Minimum zamówienia (i minimum strefy dostawy) liczymy **po rabacie**. Jeśli kod zostanie
  ustawiony bez takiego progu i po rabacie koszyk spadnie poniżej minimum, klient nie złoży
  zamówienia, dopóki nie doda produktów. To świadome ryzyko złego ustawienia kodu, sklep
  tego nie poprawia.
- Gdy klient po dodaniu kodu zmniejszy koszyk poniżej progu kodu, rabat znika, a koszyk pokazuje
  komunikat „Kod … przestał obejmować koszyk”.
- Darmowa dostawa od kwoty (gdy zostanie włączona) też liczy się od kwoty po rabacie.
- **Zamówienia na zapytanie:** kod wpisany przed zapytaniem obowiązuje, jeśli nadal jest ważny
  w chwili płatności. Gdy w międzyczasie wygaśnie albo wyczerpie się limit użyć, klient
  zapłaci cenę bez rabatu (limit liczy się dopiero przy złożonym zamówieniu). Zaakceptowane.

### Do akceptacji (teksty w sklepie, `la-palette-garden`)

- Komunikaty przy kodzie (`src/catering/medusa/data/cart.ts`): „Nie znamy takiego kodu albo
  stracił ważność.”, „Ten kod nie obejmuje Twojego koszyka — sprawdź jego warunki, np. minimalną
  wartość zamówienia.”, „Wpisz kod rabatowy.”; w koszyku
  (`src/catering/components/cart/CartContents.tsx`): „Kod … przestał obejmować koszyk — sprawdź
  jego warunki, np. minimalną wartość zamówienia.”
- Linia w mailach i podsumowaniach: „Rabat (KOD): −X zł”.

### Do ustalenia

- Czy kody będą reklamowane publicznie (np. „−10% na pierwsze zamówienie”)? Wtedy sprawdzić
  z prawnikiem obowiązki z dyrektywy Omnibus (najniższa cena z 30 dni). Indywidualne kody,
  np. dla par weselnych, zwykle tego nie wymagają.
- Regulamin: czy kody łączą się ze sobą (dziś sklep pozwala na jeden kod naraz w koszyku, ale
  Medusa technicznie przyjęłaby kilka) i czy kod obejmuje zamówienia na zapytanie.

**Decyzja:** …

## 6. Na później (bez pilności)

- **Konta klientów** (historia zamówień, ponowne zamówienie, zapamiętane dane do faktury) —
  proponujemy dopiero po starcie, gdy pojawią się stali klienci firmowi. Czy są tacy już teraz?

**Decyzja:** …
