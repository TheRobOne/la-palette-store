/**
 * Catalog mirrored from megustacatering.pl (shop listing, 2026-10-05) as a
 * working baseline. Texts and prices are Me Gusta's — replace with La Palette
 * content before going live. Allergens are not published by the source and
 * are left empty here.
 */
import type {
  DietaryTag,
  PricingUnit,
} from "../../modules/catering/models/catering-product-info"

export const CATALOG_SOURCE = "megustacatering.pl"

export const CATALOG_CATEGORIES = [
  {
    "handle": "boxy-wytrawne",
    "name": "Boxy wytrawne"
  },
  {
    "handle": "boxy-slodkie",
    "name": "Boxy słodkie"
  },
  {
    "handle": "dla-dzieci",
    "name": "Dla dzieci"
  },
  {
    "handle": "przerwy-kawowe",
    "name": "Przerwy kawowe"
  },
  {
    "handle": "dania-obiadowe",
    "name": "Dania obiadowe"
  },
  {
    "handle": "bowle",
    "name": "Bowle"
  },
  {
    "handle": "desery",
    "name": "Desery"
  },
  {
    "handle": "napoje",
    "name": "Napoje"
  }
] as const

export type CatalogProduct = {
  handle: string
  title: string
  subtitle: string | null
  description: string
  category: (typeof CATALOG_CATEGORIES)[number]["handle"]
  price: number
  min_quantity: number
  pricing_unit: PricingUnit
  ingredients: string
  dietary_tags: DietaryTag[]
}

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    "handle": "wloski",
    "title": "Box Włoski",
    "subtitle": "4–6 osób · ~2,4 kg",
    "description": "Smak włoskich tarasów - prosto na Twój stół, bez wyjmowania patelni.\n\nBox Włoski to smakowita podróż prosto na włoskie tarasy - pełna słońca, świeżości i kulinarnej radości. W zestawie: 6 porcji sałatki włoskiej z rukolą i parmezanem, 5 tartaletek z pastą bazyliową, 400 g bruschetty, 350 g oliwek marynowanych, 7 porcji prosciutto z gruszką i mascarpone oraz 10 kromek podpieczonego chleba. Buon appetito!",
    "category": "boxy-wytrawne",
    "price": 229,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "6 porcji – Sałatka włoska - rukola, orzeszki pini, płatki parmezanu i ocet balsamiczny\n4 szt. – Tartaletki z pastą bazyliową - kruche ciasto wypełnione aromatycznym musem na bazie świeżych ziół\n400 g – Bruschetta - klasyczna mieszanka soczystych pomidorów z oliwą i świeżą bazylią\n350 g – Oliwki marynowane - intensywny, esencjonalny smak śródziemnomorskiej przekąski\n7 porcji – Prosciutto z gruszką i mascarpone - delikatne, kremowe, subtelnie słodkie\n10 kromek – Podpieczony chleb z bazylią i czosnkiem - pachnąca trattoria",
    "dietary_tags": []
  },
  {
    "handle": "box-halloween",
    "title": "Box Halloween",
    "subtitle": "4–6 osób",
    "description": "Halloweenowy box wytrawny to gotowy stół na imprezę w jednym pudełku. Znajdziesz w nim czarne bułeczki bao i burgerki, krewetki w cieście kataifi, sałatki z okiem cyklopa oraz krążki cebulowe, paluszki mozzarella i frytki z batatów. Wygląda strasznie, a smakuje świetnie.\n\nBox dostępny wyłącznie w okresie 23.10.2026 - 01.11.2026",
    "category": "boxy-wytrawne",
    "price": 259,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "1 porcja – krążków cebulowych\n1 porcja – paluszków mozzarella\n1 porcja – frytek z batatów\n1 porcja – krewetek w cieście kataifi\n4 sztuki – czarnych bułeczek bao z szarpaną wieprzowiną i marchewką po koreańsku\n4 sztuki – czarnych burgerków z panierowanym kurczakiem z serem, świeżymi warzywami i sosem słodko-kwaśnym\n5 sztuk – sałatek włoskich z okiem cyklopa",
    "dietary_tags": []
  },
  {
    "handle": "deska",
    "title": "Deska Serów i Szynek",
    "subtitle": "4–6 osób · ~1,9 kg",
    "description": "Przenieś swoje spotkanie na wyższy poziom elegancji z naszą Deską Serów i Szynek - przemyślanym zestawem dopracowanych serów i długo dojrzewających wędlin. Kremowy camembert, aromatyczne sery (w tym ziołowe i scamorza), delikatna mozzarella, wyraziste wędliny jak rostbef i fuet. Całość dopełniają winogrona, rukola, oliwki i orzechy, a także miód i oliwa truflowa, oraz pieczywo, grissini i krakersy.",
    "category": "boxy-wytrawne",
    "price": 259,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "150 g – Prosciutto - delikatna, dojrzewająca szynka o maślanej strukturze\n120 g – Chorizo i salami - wyraziste wędliny o głębokim aromacie\n120 g – Szynka długo dojrzewająca - kwintesencja smaku i elegancji\n120 g – Ser Lazur ze śliwką - intensywny ser pleśniowy przełamany nutą słodyczy\n120 g – Camembert z karmelizowanym orzechem i żurawiną - aksamitny i pełen kontrastów\n100 g – Ser kozi z chipsami z jabłka, miodem i prażonymi migdałami - lekki, aromatyczny\n100 g – Ser wędzony - głęboki, wyrazisty akcent dopełniający kompozycję",
    "dietary_tags": []
  },
  {
    "handle": "kanapeczki",
    "title": "Box Kanapeczki",
    "subtitle": "4–6 osób · ~1,8 kg · 24 szt.",
    "description": "Daj się oczarować finezją mini kanapek, które podniosą rangę każdego spotkania. Box Kanapeczki to połączenie elegancji, wygody i wyjątkowego smaku - idealne zarówno na kameralne przyjęcie, jak i biznesowy lunch. W zestawie 24 mini kanapki w czterech wariantach: z wędzonym łososiem, z pieczoną papryką i fetą, z krewetką oraz ze szprotką. Każda kanapka to małe dzieło smaku, gotowe do podania.",
    "category": "boxy-wytrawne",
    "price": 189,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "6 szt. – Mini kanapki z wędzonym łososiem - delikatne, pełne głębi\n6 szt. – Mini kanapki z pieczoną papryką i fetą - śródziemnomorski akcent\n6 szt. – Mini kanapki z krewetką - lekkie, świeże, subtelnie morskie\n6 szt. – Mini kanapki ze szprotką - tradycja w nowoczesnej odsłonie",
    "dietary_tags": []
  },
  {
    "handle": "kanapeczki-2",
    "title": "Box Kanapeczki II",
    "subtitle": "4–6 osób · ~1,8 kg · 24 szt.",
    "description": "Zestaw, który łączy klasykę z nowoczesnością - pełen wyrafinowanych smaków i zaskakujących duetów. 24 mini kanapki w czterech autorskich połączeniach: pasta jajeczna z szynką i goudą, mus wiśniowy z serem lazur i karmelizowanymi orzechami, fromage z bresaolą i pieczoną papryką oraz mus z tuńczyka z pastrami i piklowaną cebulką. Idealny wybór, gdy chcesz podać coś efektownego, ale bez nadmiaru formalności.",
    "category": "boxy-wytrawne",
    "price": 189,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "6 szt. – Pasta jajeczna z szynką i goudą - subtelna, kremowa, zbalansowana\n6 szt. – Mus wiśniowy z serem lazur i karmelizowanymi orzechami\n6 szt. – Fromage z bresaolą i pieczoną papryką - elegancka inspiracja włoską kuchnią\n6 szt. – Mus z tuńczyka z pastrami i piklowaną cebulką - głęboki, wyrazisty smak",
    "dietary_tags": []
  },
  {
    "handle": "rolowane",
    "title": "Box Kanapeczki Rolowane",
    "subtitle": "4–6 osób · ~1,5 kg · 50 szt.",
    "description": "Różnorodne smaki w kompaktowej formie - idealne na spotkania, przyjęcia i przerwy w pracy. Około 50 sztuk w czterech apetycznych wariantach: Salami Milano z suszonymi pomidorami, Hummus Paprykowy z fetą i oliwkami, Sałatka z kurczakiem oraz A'la Caprese z mozzarellą i pomidorem. Lekka, efektowna i gotowa do podania przekąska.",
    "category": "boxy-wytrawne",
    "price": 179,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "12-13 szt. – Salami Milano - wyraziste salami z suszonymi pomidorami\n12-13 szt. – Hummus Paprykowy - kremowy hummus z papryką, fetą, czarnymi oliwkami\n12-13 szt. – Sałatka z kurczakiem - klasyczny smak w lekkiej odsłonie\n12-13 szt. – À la Caprese - mozzarella, pomidor, bazylia, oliwa",
    "dietary_tags": []
  },
  {
    "handle": "antipasti",
    "title": "Box Antipasti",
    "subtitle": "4–6 osób · ~2,0 kg",
    "description": "Box Antipasti to włoska uczta pełna wyrafinowanych smaków. W zestawie: kabanosy o wyrazistym smaku z bursztynowym serem, soczysta szynka wieprzowa z pieca z marynowanymi opieńkami, delikatne pastrami z winogronami i grissini, papryczki faszerowane kremowym serkiem, oliwki czarne gigant z borowikami, oliwki zielone gigant z dojrzewającym Gouda oraz marynowane borowiki.",
    "category": "boxy-wytrawne",
    "price": 229,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "200 g – Kabanosy Berlinki - klasyczne, o wyrazistym smaku, idealne z bursztynowym serem\n200 g – Szynka wieprzowa z pieca - soczysta, z marynowanymi opieńkami i papryką\n150 g – Pastrami - delikatna pieczona wołowina ze świeżymi winogronami i grissini\n150 g – Papryczki mix z serkiem w oleju - pikantne, faszerowane kremowym serkiem\n180 g – Oliwki czarne gigant z pestką - intensywne, z marynowanymi borowikami\n180 g – Oliwki zielone gigant z pestką - chrupiące, z dojrzewającym serem Gouda\n120 g – Borowiki marynowane - dopracowany dodatek dopełniający szynkę parmeńską",
    "dietary_tags": []
  },
  {
    "handle": "mix",
    "title": "Box Mix",
    "subtitle": "4–6 osób · ~1,9 kg",
    "description": "Box Mix to idealny wybór na spotkania, przyjęcia i eventy. W zestawie: 5 tartaletek z gorgonzolą i karmelizowaną gruszką, 10-12 mini rolowanych kanapek z długo dojrzewającą szynką, 8 koreczków z szynką oraz 12 kawałków bajgla z pastrami i sosem z tuńczyka.",
    "category": "boxy-wytrawne",
    "price": 229,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "4 szt. – Tartaletki z gorgonzolą i karmelizowaną gruszką\n10-12 szt. – Mini rolowane kanapki z długo dojrzewającą szynką\n8 szt. – Koreczki z szynką - małe, dopracowane porcje\n12 szt. – Kawałki bajgla z pastrami i sosem z tuńczyka",
    "dietary_tags": []
  },
  {
    "handle": "kanapki-swiata",
    "title": "Box Kanapki Świata",
    "subtitle": "4–6 osób · ~1,8 kg",
    "description": "Box Kanapki Świata to autorska kompozycja 18 sycących przekąsek, które łączą egzotykę Azji, amerykański klasyk i włoski temperament. Idealny wybór, gdy chcesz postawić na różnorodność i zaskoczyć niebanalnym menu. W zestawie 18 wyrazistych porcji w czterech odsłonach: puszyste Bułeczki Bao z Krewetką z chrupiącym wakame i aromatycznym imbirem, Czarne Bao ze Stripsami z soczystym kurczakiem i papryką, Smash Burgery w stylu Oklahoma z intensywnie wysmażoną wołowiną i skarmelizowaną cebulą oraz Włoska Ciabatta z Prosciutto, mozzarellą i suszonymi pomidorami.",
    "category": "boxy-wytrawne",
    "price": 239,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "3 szt. – Bułeczki Bao z Krewetką - azjatycki klasyk z wakame i imbirem\n3 szt. – Czarne Bao ze Stripsami - ciemne bułeczki z kurczakiem i papryką konserwową\n6 porcji – Smash Burgery Oklahoma - wołowina ze skarmelizowaną cebulą\n6 porcji – Ciabatta z Prosciutto - szynka dojrzewająca, mozzarella, suszone pomidory",
    "dietary_tags": []
  },
  {
    "handle": "tortilla",
    "title": "Box Tortilla",
    "subtitle": "4–6 osób · ~1,8 kg",
    "description": "Zaskocz swoich gości zestawem wykwintnych tortilli w czterech wyjątkowych odsłonach. Box Tortilla to różnorodna, wygodna i stylowa propozycja na każdą okazję. W zestawie: Tortille Burrito z mięsem i świeżymi warzywami, Tortille Cezar z grillowanym kurczakiem i chipsem z boczku, Tortille z mozzarellą i pomidorem oraz Tortille z łososiem i kremowym serkiem.",
    "category": "boxy-wytrawne",
    "price": 189,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "1 szt. – Tortille Burrito - sycąca kompozycja z mięsem i świeżymi warzywami\n1 szt. – Tortille Cezar - grillowany kurczak, sałata rzymska i chips z boczku\n1 szt. – Tortille z mozzarellą i pomidorem - lekka, śródziemnomorska propozycja\n1 szt. – Tortille z łososiem - delikatny wędzony łosoś z kremowym serkiem",
    "dietary_tags": []
  },
  {
    "handle": "bajgle",
    "title": "Box Bajgle",
    "subtitle": "4–6 osób · ~1,5 kg",
    "description": "Box Bajgle to idealna propozycja na spotkania, eventy i wspólny lunch. 15 bajgli w 3 różnorodnych wariantach: z bekonem, jajkiem sadzonym i sosem chrzanowym (konkretne i sycące), z łososiem i awokado (lekkie i eleganckie) oraz z panierowanymi stripsami i papryką (chrupiące i apetyczne).",
    "category": "boxy-wytrawne",
    "price": 239,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "5 szt. – Bajgiel z bekonem, jajkiem sadzonym i sosem chrzanowym\n5 szt. – Bajgiel z łososiem i awokado\n5 szt. – Bajgiel z panierowanymi stripsami i papryką",
    "dietary_tags": []
  },
  {
    "handle": "salatki",
    "title": "Box Mini Sałatki",
    "subtitle": "4–6 osób · ~2,2 kg · 30 szt.",
    "description": "Box Mini Sałatek to 30 porcji starannie skomponowanych smaków, które idealnie sprawdzą się podczas luźnych przyjęć czy formalnych bankietów. W zestawie: sałatka z kurczakiem, sałatka z kaczką z owocową nutą, sałatka z krewetką w lekkim dressingu, sałatka z łososiem oraz klasyczne Caprese z mozzarellą i pomidorem.",
    "category": "boxy-wytrawne",
    "price": 229,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "6 szt. – Sałatka z kurczakiem - soczyste kawałki grillowanego kurczaka na świeżych warzywach\n6 szt. – Sałatka z kaczką - aromatyczna kaczka, chrupiące sałaty i owocowa nuta\n6 szt. – Sałatka z krewetką - delikatne krewetki z lekkim dressingiem\n6 szt. – Sałatka z łososiem - wędzony łosoś na zielonych liściach, cytryna i oliwa\n6 szt. – Caprese - klasyczna włoska sałatka z dojrzałymi pomidorami i mozzarellą",
    "dietary_tags": []
  },
  {
    "handle": "vege-lf",
    "title": "Box Vege Lactose Free",
    "subtitle": "4–6 osób · ~2,4 kg",
    "description": "Box Vege Lactose Free to roślinna uczta pełna świeżości, koloru i wyrazistego smaku - bez grama laktozy. W zestawie: 10 roladek z pesto z pomidorów i orzeszków pini, 400 g pasty z pieczonej papryki, guacamole z 2 awokado, 350 g brokuła i kalafiora, 6 porcji sałatki z wakame, 150 g warzyw w słupkach oraz cały bochenek pieczywa.",
    "category": "boxy-wytrawne",
    "price": 229,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "10 szt. – Roladki z pesto z pomidorów i orzeszków pini, podane z marynowaną rzodkwią\n400 g – Pasta z pieczonej papryki z pestkami słonecznika\n2 szt. – Guacamole z 2 awokado - aksamitna pasta podana z chrupiącymi nachosami\n350 g – Brokuł i kalafior w aromatycznej marynacie\n6 porcji – Sałatka z wakame i guacamole - subtelne wodorosty z dodatkiem warzyw\n150 g – Warzywa w słupkach - świeże, kolorowe, idealne do maczania\n1 bochenek – Pieczywo - świetne uzupełnienie do past i warzyw",
    "dietary_tags": [
      "vegetarian",
      "lactose_free"
    ]
  },
  {
    "handle": "burgerki",
    "title": "Box Mini Burgerki",
    "subtitle": "4–6 osób · ~2,4 kg · 16 szt.",
    "description": "Box Mini Burgerki to zestaw czterech wyjątkowych kompozycji smakowych - idealny na spotkania, przerwy w pracy lub jako efektowna przekąska na eventy. 16 miniburgerów (po 4 z każdego rodzaju): Classic Burger z wołowiną i sosem barbecue, Chicken Burger z udkiem w sriracha mayo, Pork Burger z szarpaną wieprzowiną oraz Wege Burger z panierowanym camembertem i guacamole.",
    "category": "boxy-wytrawne",
    "price": 259,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "4 szt. – Classic Burger - wołowina z sosem barbecue, boczek, ser, ogórek, pomidor i sałata\n4 szt. – Chicken Burger - soczyste udko z kurczaka z sosem sriracha mayo\n4 szt. – Pork Burger - aromatyczna szarpana wieprzowina w delikatnej, miękkiej bułce\n4 szt. – Wege Burger - panierowany camembert z guacamole i koreańską marchewką",
    "dietary_tags": []
  },
  {
    "handle": "street-food",
    "title": "Box Street Food",
    "subtitle": "4–6 osób · ~2,2 kg",
    "description": "Box Street Food to kulinarna podróż przez najbardziej apetyczne zakątki świata. W zestawie: quesadilla pokrojona na 8 kawałków z kurczakiem, szpinakiem i pomidorem, 8-10 taco z burrito-style nadzieniem i japońskim majonezem, 9-10 pikantnych skrzydełek z grilla, 5 bułeczek bao z szarpaną wieprzowiną oraz sos czosnkowy.",
    "category": "boxy-wytrawne",
    "price": 219,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "1 szt. – Quesadilla pokrojona na 8 kawałków - tortilla z kurczakiem i serem\n8-10 szt. – Taco z burrito-style nadzieniem, japońskim majonezem i jalapeño\n9-10 szt. – Skrzydełka z grilla - soczyste, przyprawione na ostro\n5 szt. – Bułeczki bao - puszyste, azjatyckie z szarpaną wieprzowiną i sosem teriyaki\n80 ml – Sos czosnkowy - kremowy, wyrazisty",
    "dietary_tags": []
  },
  {
    "handle": "bao",
    "title": "Box Bułeczki Bao",
    "subtitle": "4–6 osób · ~2,3 kg",
    "description": "Wprowadź swoich gości w świat azjatyckich smaków i nowoczesnego street foodu. Box BAO to efektowne, parowane bułeczki łączące puszystą strukturę, chrupiące dodatki i intensywne sosy. 16 bułeczek BAO w trzech wariantach: białe z soczystym kurczakiem i chrupiącą sałatą, czarne z krewetką w tempurze i sosem imbirowo-miodowym oraz czarne z szarpaną wieprzowiną i czerwoną kapustą.",
    "category": "boxy-wytrawne",
    "price": 219,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "5 szt. – Bao z duszoną wieprzowiną char siu - soczyste, słodko-słone\n5 szt. – Bao z z krewetką w tempurze i sosem imbirowo-miodowym\n6 szt. – Bao z grillowanym kurczakiem teriyaki - lekko karmelizowane",
    "dietary_tags": []
  },
  {
    "handle": "panierowany",
    "title": "Box Panierowany",
    "subtitle": "4–6 osób · ~3,0 kg",
    "description": "Box Panierowany to pełen złocistych, chrupiących przekąsek zestaw. W zestawie: 11 sajgonek z warzywami, 8-9 stripsów z kurczaka, 6 krewetek w panierce, 12 krążków cebulowych, 7 paluszków mozzarelli, 7 porcji Pad Thai na patyku, 8 kawałków panierowanego camemberta, 9 pikantnych kulek serowych, 10 kulek vege oraz 4 sosy.",
    "category": "boxy-wytrawne",
    "price": 259,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "11 szt. – Sajgonki - warzywa w chrupiącym cieście z nutą orientu\n8-9 szt. – Stripsy z kurczaka - soczyste kawałki w chrupiącej panierce\n6 szt. – Krewetki w panierce - delikatne, soczyste, chrupiące\n12 szt. – Krążki cebulowe - słodka cebula w klasycznym wydaniu\n7 szt. – Paluszki mozzarelli - ciągnący się ser w złocistej panierce\n7 szt. – Pad Thai na patyku - wygodna, aromatyczna przekąska\n8 szt. – Panierowany camembert - kremowy środek i chrupiąca skorupka\n9 szt. – Pikantne kulki serowe - wyrazisty smak i doskonała chrupkość\n10 szt. – Kulki vege - warzywna alternatywa pełna smaku\n4 × 80 ml – 4 sosy do maczania",
    "dietary_tags": []
  },
  {
    "handle": "croissant-w",
    "title": "Box Croissanty Wytrawne",
    "subtitle": "4–6 osób · ~1,3 kg · 12 szt.",
    "description": "Złociste, maślane croissanty w wytrawnej odsłonie - elegancka przekąska, która sprawdzi się na spotkaniach, brunchach i domowych przyjęciach. Trzy wyjątkowe warianty: mozzarella, świeże pomidory i sałata, pierś z kurczaka z dodatkami oraz salami i ser cheddar.",
    "category": "boxy-wytrawne",
    "price": 209,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "4 szt. – Mini croissanty z mozzarellą, świeżymi pomidorami i sałatą\n4 szt. – Mini croissanty z piersią z kurczaka i dodatkami\n4 szt. – Mini croissanty z salami i serem cheddar",
    "dietary_tags": []
  },
  {
    "handle": "box-muffiny",
    "title": "Box Muffiny",
    "subtitle": "4–6 osób · ~1,8 kg · 15 szt.",
    "description": "Box Muffiny to nasza odpowiedź na pytanie, co podać rano zamiast kolejnych kanapek. W zestawie 15 wytrawnych muffinów w trzech smakach: 5 sztuk z bekonem i jajkiem sadzonym dla tych, którzy lubią konkret, 5 sztuk z twarożkiem, ogórkiem i sałatą - lekkich i świeżych, oraz 5 sztuk ze smażonymi pieczarkami i serem cheddar, w wersji bez mięsa, ale z charakterem. Trzy smaki w jednym zestawie sprawiają, że każdy przy stole znajdzie coś dla siebie - dlatego sprawdza się na porannym spotkaniu, szkoleniu i firmowym brunchu.",
    "category": "boxy-wytrawne",
    "price": 219,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "5 sztuk – Muffin z jajkiem i bekonem\n5 sztuk – Muffin z twarożkiem i ogórkiem\n5 sztuk – Muffin z smażonymi pieczarkami i serem cheddar",
    "dietary_tags": []
  },
  {
    "handle": "box-tartaletki",
    "title": "Box Tartaletki",
    "subtitle": "4–6 osób",
    "description": "Box Tartaletek i Eklerów to cztery smaki zamknięte w kruchym cieście: krewetka na aksamitnym awokado z iskrą chili, feta z prosciutto i dojrzałą figą, wędzony kurczak z soczystym granatem oraz mascarpone z miodem i cytrynową świeżością.",
    "category": "boxy-wytrawne",
    "price": 199,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "4 sztuki – Tartaletki z pastą z awokado i krewetką, z płatkami chili i pieczonym pomidorkiem\n6 sztuk – Eklerów z ubijaną fetą, prosciutto i figą\n4 sztuki – Tartaletki z sałatką z wędzonego kurczaka z granatem\n4 sztuki – Tartaletki z fetą i mascarpone, z papryką, miodem i skórką cytryny",
    "dietary_tags": []
  },
  {
    "handle": "owocowy",
    "title": "Box Owocowy",
    "subtitle": "4–6 osób · ~1,3 kg",
    "description": "Sezonowy owocowy stół jak z sesji - kolor, świeżość i lekkość na każdym stole.\n\nPełen kolorów, świeżości i naturalnej słodyczy - Box Owocowy to elegancka kompozycja sezonowych owoców, która doda energii każdemu spotkaniu.",
    "category": "boxy-slodkie",
    "price": 279,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "300 g – Soczysty ananas i melon - krojone w trójkąty\n200 g – Kiwi i winogrono - kolorowy akcent\n200 g – Figi, pomarańcza, grejpfrut - przyjemna kwaskowość\n150 g – Marakuja, pitaja - owoce egzotyczne\n200 g – Maliny, jagody, truskawki - sezonowo\n30 g – Świeże listki mięty i edible flowers",
    "dietary_tags": []
  },
  {
    "handle": "slodki",
    "title": "Box Słodki",
    "subtitle": "4–6 osób · ~1,8 kg · 30 szt.",
    "description": "Słodki Box to elegancki zestaw mini deserów w pięciu wyjątkowych smakach - idealny na finał spotkania. 30 porcji deserów: Leśny Mech z pistacjami i szpinakiem, Oreo w nowoczesnej formie, deser z białą czekoladą i malinami, deser Lotus, jogurtowy z żelką mango-marakuja oraz Kinder bueno.",
    "category": "boxy-slodkie",
    "price": 259,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "5 szt. – Leśny Mech - aksamitny krem z nutą pistacji i szpinaku\n5 szt. – Oreo - klasyczne połączenie czekolady i wanilii\n5 szt. – Deser z białą czekoladą i malinami\n5 szt. – Deser Lotus - karmelowo-korzennych z ciasteczkami i kremem Lotus Biscoff\n5 szt. – Jogurtowy z żelką mango-marakuja\n5 szt. – Kinder Bueno - kremowa przekąska inspirowana smakiem znanym z dzieciństwa",
    "dietary_tags": []
  },
  {
    "handle": "croissant-s",
    "title": "Box Croissanty Słodkie",
    "subtitle": "4–6 osób · ~1,2 kg · 18 szt.",
    "description": "Maślane, delikatne croissanty w trzech wyjątkowych odsłonach, które zachwycają aromatem i finezją smaku. Idealne na poranne spotkanie, przerwę przy kawie lub słodkie zakończenie przyjęcia.",
    "category": "boxy-slodkie",
    "price": 159,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "6 szt. – Mini croissanty kakaowo-orzechowe - intensywny smak\n6 szt. – Mini croissanty z morelowym nadzieniem - owocowa słodycz\n6 szt. – Mini croissanty z kremem pâtissière - aksamitny waniliowy krem",
    "dietary_tags": []
  },
  {
    "handle": "kids",
    "title": "Box Chrupiące Przysmaki",
    "subtitle": "4–6 osób · ~2,5 kg",
    "description": "Daj się uwieść chrupiącej frajdzie! Box Chrupiące Przysmaki to idealny zestaw na urodziny i spotkania z przyjaciółmi. W zestawie: paluszki serowe, stripsy z kurczaka, placki ziemniaczane w mini wydaniu, corndogi w chrupiącym cieście kukurydzianym oraz krążki cebulowe. Gwarancja udanej zabawy i pełnych brzuszków.",
    "category": "dla-dzieci",
    "price": 259,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "12 szt. – Paluszki serowe - złociste i ciągnące, idealne do podjadania\n10 szt. – Stripsy z kurczaka - chrupiące na zewnątrz, soczyste w środku\n10 szt. – Placki ziemniaczane - klasyk w mini wydaniu\n300 g – Zakręcone frytki - zabawna forma i pyszny smak\n8 szt. – Mini pizza - małe, ale pełne smaku kawałki\n10 szt. – Corndogi - parówki w chrupiącym cieście kukurydzianym\n12 szt. – Krążki cebulowe - chrupiące, złociste i aromatyczne\n2 sosy – Keczup i majonez do maczania",
    "dietary_tags": []
  },
  {
    "handle": "pancake",
    "title": "Box Pancake",
    "subtitle": "4–6 osób · ~2,3 kg",
    "description": "Daj się porwać słodkiej przyjemności! Box Pancake to słodki zestaw na każdą okazję. Naleśniki z trzema rodzajami nadzienia (Snickers, wanilia, twarożek jagodowy), puszyste pankejki bananowe, sałatka z owoców sezonowych z dipem miodowo-miętowym oraz 3 sosy (jagoda, karmel, czekolada).",
    "category": "dla-dzieci",
    "price": 179,
    "min_quantity": 1,
    "pricing_unit": "piece",
    "ingredients": "8 szt. – Naleśniki Snickers - kremowe wnętrze z czekolady, karmelu i masła orzechowego\n8 szt. – Naleśniki waniliowe - delikatne, aksamitne nadzienie\n8 szt. – Naleśniki z twarożkiem jagodowym - wypełnione twarożkiem z leśnymi jagodami\n20 szt. – Pankejki bananowe - puszyste i naturalnie słodkie\n400 g – Sałatka z owoców sezonowych z dipem miodowo-miętowym\n3 × 100 ml – 3 sosy - jagoda, karmel, czekolada",
    "dietary_tags": []
  },
  {
    "handle": "przerwa-kawowa-basic",
    "title": "Przerwa kawowa Basic",
    "subtitle": null,
    "description": "Warnik · zastawa papierowa eko · kawa rozpuszczalna/sypana/herbata · 2 rodzaje ciasteczek · woda w karafkach",
    "category": "przerwy-kawowe",
    "price": 35,
    "min_quantity": 12,
    "pricing_unit": "person",
    "ingredients": "Warnik · zastawa papierowa eko · kawa rozpuszczalna/sypana/herbata · 2 rodzaje ciasteczek · woda w karafkach",
    "dietary_tags": []
  },
  {
    "handle": "przerwa-kawowa-standard",
    "title": "Przerwa kawowa Standard",
    "subtitle": null,
    "description": "Ekspres + warnik · zastawa papierowa eko · kawa ziarnista/rozpuszczalna/sypana/herbata kilka rodzajów · 4 rodzaje ciasteczek · woda w karafkach",
    "category": "przerwy-kawowe",
    "price": 40,
    "min_quantity": 12,
    "pricing_unit": "person",
    "ingredients": "Ekspres + warnik · zastawa papierowa eko · kawa ziarnista/rozpuszczalna/sypana/herbata kilka rodzajów · 4 rodzaje ciasteczek · woda w karafkach",
    "dietary_tags": []
  },
  {
    "handle": "przerwa-kawowa-premium",
    "title": "Przerwa kawowa Premium",
    "subtitle": null,
    "description": "Ekspres + warnik · zastawa porcelanowa · kawa ziarnista/rozpuszczalna/sypana/herbata kilka rodzajów · 4 rodzaje ciasteczek · woda w karafkach",
    "category": "przerwy-kawowe",
    "price": 60,
    "min_quantity": 12,
    "pricing_unit": "person",
    "ingredients": "Ekspres + warnik · zastawa porcelanowa · kawa ziarnista/rozpuszczalna/sypana/herbata kilka rodzajów · 4 rodzaje ciasteczek · woda w karafkach",
    "dietary_tags": []
  },
  {
    "handle": "strogonow",
    "title": "Strogonow",
    "subtitle": null,
    "description": "Wołowina w sosie z grzybami · pojemnik 5 l (ok. 10 porcji)",
    "category": "dania-obiadowe",
    "price": 32,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Wołowina w sosie z grzybami · pojemnik 5 l (ok. 10 porcji)",
    "dietary_tags": []
  },
  {
    "handle": "rosol-makaron",
    "title": "Rosół z makaronem",
    "subtitle": null,
    "description": "Klarowny wywar z makaronem · pojemnik 5 l (ok. 10 porcji)",
    "category": "dania-obiadowe",
    "price": 21,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Klarowny wywar z makaronem · pojemnik 5 l (ok. 10 porcji)",
    "dietary_tags": []
  },
  {
    "handle": "krem-pomidorowy",
    "title": "Krem pomidorowy",
    "subtitle": null,
    "description": "Z grzankami i bazylią",
    "category": "dania-obiadowe",
    "price": 21,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Z grzankami i bazylią",
    "dietary_tags": []
  },
  {
    "handle": "tom-kha",
    "title": "Zupa tajska Tom Kha",
    "subtitle": null,
    "description": "Tajska z mlekiem kokosowym, kurczakiem i imbirem · pojemnik 5 l (ok. 10 porcji)",
    "category": "dania-obiadowe",
    "price": 32,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Tajska z mlekiem kokosowym, kurczakiem i imbirem · pojemnik 5 l (ok. 10 porcji)",
    "dietary_tags": []
  },
  {
    "handle": "karczek-grzybowy",
    "title": "Karczek w sosie grzybowym",
    "subtitle": null,
    "description": "120–150 g",
    "category": "dania-obiadowe",
    "price": 20,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "120–150 g",
    "dietary_tags": []
  },
  {
    "handle": "de-volaille",
    "title": "De volaille",
    "subtitle": null,
    "description": "Klasyczny kotlet z masłem ziołowym · 170–200 g",
    "category": "dania-obiadowe",
    "price": 27,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Klasyczny kotlet z masłem ziołowym · 170–200 g",
    "dietary_tags": []
  },
  {
    "handle": "schabowy",
    "title": "Schabowy",
    "subtitle": null,
    "description": "130–150 g",
    "category": "dania-obiadowe",
    "price": 24,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "130–150 g",
    "dietary_tags": []
  },
  {
    "handle": "poledwiczki",
    "title": "Polędwiczki wieprzowe w sosie kurkowym",
    "subtitle": null,
    "description": "100–130 g",
    "category": "dania-obiadowe",
    "price": 30,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "100–130 g",
    "dietary_tags": []
  },
  {
    "handle": "stripsy-kurczak",
    "title": "Stripsy z kurczaka",
    "subtitle": null,
    "description": "Chrupiące w panierce",
    "category": "dania-obiadowe",
    "price": 24,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Chrupiące w panierce",
    "dietary_tags": []
  },
  {
    "handle": "losos-pieczony",
    "title": "Łosoś pieczony",
    "subtitle": null,
    "description": "130–150 g",
    "category": "dania-obiadowe",
    "price": 31,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "130–150 g",
    "dietary_tags": []
  },
  {
    "handle": "puree-ziemniaczane",
    "title": "Purée ziemniaczane",
    "subtitle": null,
    "description": "180 g",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "180 g",
    "dietary_tags": []
  },
  {
    "handle": "ziemniaki",
    "title": "Ziemniaki pieczone",
    "subtitle": null,
    "description": "180 g · z rozmarynem i czosnkiem",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "180 g · z rozmarynem i czosnkiem",
    "dietary_tags": []
  },
  {
    "handle": "kluski-slaskie",
    "title": "Kluski śląskie + sos pieczeniowy",
    "subtitle": null,
    "description": "Klasyczny dodatek do mięs",
    "category": "dania-obiadowe",
    "price": 12,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Klasyczny dodatek do mięs",
    "dietary_tags": []
  },
  {
    "handle": "kopytka",
    "title": "Kopytka z sosem",
    "subtitle": null,
    "description": "180 g · z sosem pieczeniowym",
    "category": "dania-obiadowe",
    "price": 12,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "180 g · z sosem pieczeniowym",
    "dietary_tags": []
  },
  {
    "handle": "kasza-gryczana",
    "title": "Kasza gryczana",
    "subtitle": null,
    "description": "180 g",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "180 g",
    "dietary_tags": []
  },
  {
    "handle": "ryz-gotowany",
    "title": "Ryż gotowany",
    "subtitle": null,
    "description": "180 g",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "180 g",
    "dietary_tags": []
  },
  {
    "handle": "chili-sin-carne",
    "title": "Chili sin carne (wege)",
    "subtitle": null,
    "description": "200 g · bez mięsa",
    "category": "dania-obiadowe",
    "price": 27,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "200 g · bez mięsa",
    "dietary_tags": [
      "vegetarian"
    ]
  },
  {
    "handle": "chili-con-carne",
    "title": "Chili con carne",
    "subtitle": null,
    "description": "200 g",
    "category": "dania-obiadowe",
    "price": 27,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "200 g",
    "dietary_tags": []
  },
  {
    "handle": "coleslaw",
    "title": "Coleslaw",
    "subtitle": null,
    "description": "Kremowa surówka z białej kapusty i marchewki - klasyczny dodatek do mięs",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "Kremowa surówka z białej kapusty i marchewki - klasyczny dodatek do mięs",
    "dietary_tags": []
  },
  {
    "handle": "buraczki",
    "title": "Buraczki na ciepło",
    "subtitle": null,
    "description": "150–170 g · tarte z chrzanem",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "150–170 g · tarte z chrzanem",
    "dietary_tags": []
  },
  {
    "handle": "marchewka",
    "title": "Marchewka z groszkiem",
    "subtitle": null,
    "description": "150–170 g · klasyczny dodatek warzywny",
    "category": "dania-obiadowe",
    "price": 10,
    "min_quantity": 10,
    "pricing_unit": "portion",
    "ingredients": "150–170 g · klasyczny dodatek warzywny",
    "dietary_tags": []
  },
  {
    "handle": "bowl-skandynawski",
    "title": "Bowl Skandynawski",
    "subtitle": null,
    "description": "Pieczony ziemniak, łosoś wędzony, feta, rukola, kapary, jajko, koperek i delikatny majonez.",
    "category": "bowle",
    "price": 23,
    "min_quantity": 5,
    "pricing_unit": "piece",
    "ingredients": "Pieczony ziemniak, łosoś wędzony, feta, rukola, kapary, jajko, koperek i delikatny majonez.",
    "dietary_tags": []
  },
  {
    "handle": "bowl-orientalny",
    "title": "Bowl Orientalny",
    "subtitle": null,
    "description": "Ryż, wołowina po tajsku, goma wakame, daikon, sezam, szczypior i płatki chili.",
    "category": "bowle",
    "price": 23,
    "min_quantity": 5,
    "pricing_unit": "piece",
    "ingredients": "Ryż, wołowina po tajsku, goma wakame, daikon, sezam, szczypior i płatki chili.",
    "dietary_tags": []
  },
  {
    "handle": "bowl-cezar",
    "title": "Bowl Cezar",
    "subtitle": null,
    "description": "Ryż, soczysta pierś z kurczaka, mix sałat, pomidorki koktajlowe, parmezan i klasyczny dressing Cezar.",
    "category": "bowle",
    "price": 23,
    "min_quantity": 5,
    "pricing_unit": "piece",
    "ingredients": "Ryż, soczysta pierś z kurczaka, mix sałat, pomidorki koktajlowe, parmezan i klasyczny dressing Cezar.",
    "dietary_tags": []
  },
  {
    "handle": "bowl-burrito",
    "title": "Bowl Burrito",
    "subtitle": null,
    "description": "Ryż, chili con carne, guacamole, pomidorki koktajlowe, papryka, kolendra i płatki chili.",
    "category": "bowle",
    "price": 23,
    "min_quantity": 5,
    "pricing_unit": "piece",
    "ingredients": "Ryż, chili con carne, guacamole, pomidorki koktajlowe, papryka, kolendra i płatki chili.",
    "dietary_tags": []
  },
  {
    "handle": "bowl-weganski",
    "title": "Bowl Wegański",
    "subtitle": null,
    "description": "Komosa, szpinak, grillowana cukinia, marynowana czerwona kapusta, pomidorki, nerkowce i sos orzechowy.",
    "category": "bowle",
    "price": 23,
    "min_quantity": 5,
    "pricing_unit": "piece",
    "ingredients": "Komosa, szpinak, grillowana cukinia, marynowana czerwona kapusta, pomidorki, nerkowce i sos orzechowy.",
    "dietary_tags": [
      "vegan",
      "vegetarian"
    ]
  },
  {
    "handle": "sloik-lotus",
    "title": "Lotus",
    "subtitle": null,
    "description": "Słodki słoik z kremem Lotus",
    "category": "desery",
    "price": 15,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Słodki słoik z kremem Lotus",
    "dietary_tags": []
  },
  {
    "handle": "sloik-oreo",
    "title": "Oreo",
    "subtitle": null,
    "description": "Słodki słoik z ciastkami Oreo",
    "category": "desery",
    "price": 15,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Słodki słoik z ciastkami Oreo",
    "dietary_tags": []
  },
  {
    "handle": "sloik-kinder-bueno",
    "title": "Kinder Bueno",
    "subtitle": null,
    "description": "Słodki słoik z kremem Kinder Bueno",
    "category": "desery",
    "price": 15,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Słodki słoik z kremem Kinder Bueno",
    "dietary_tags": []
  },
  {
    "handle": "sloik-skyrnik",
    "title": "Skyrnik na zimno z granolą i polewą mango–marakuja",
    "subtitle": null,
    "description": "Skyr na zimno, granola, polewa mango–marakuja",
    "category": "desery",
    "price": 15,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Skyr na zimno, granola, polewa mango–marakuja",
    "dietary_tags": []
  },
  {
    "handle": "lemoniada-rabarbar-cytryna",
    "title": "Lemoniada rabarbar-cytryna",
    "subtitle": null,
    "description": "Butelka 330 ml",
    "category": "napoje",
    "price": 12,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Butelka 330 ml",
    "dietary_tags": []
  },
  {
    "handle": "lemoniada-cytryna-pomarancza",
    "title": "Lemoniada cytryna-pomarańcza",
    "subtitle": null,
    "description": "Butelka 330 ml",
    "category": "napoje",
    "price": 13,
    "min_quantity": 10,
    "pricing_unit": "piece",
    "ingredients": "Butelka 330 ml",
    "dietary_tags": []
  }
]
