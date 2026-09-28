/**
 * All customer-facing shell text, in one place (spec FR-008: "not embedded
 * directly in components" — a typed dictionary here, no i18n library, since
 * the storefront has a single locale, pl, for now — see research R-08).
 */
export const pl = {
  brand: {
    name: "La Palette Store",
  },
  nav: {
    home: "Strona główna",
    menu: "Menu",
    contact: "Kontakt",
  },
  hero: {
    title: "Catering na Twoją okazję",
    subtitle:
      "Smaki La Palette Garden — na wesela, konferencje i spotkania rodzinne.",
  },
  products: {
    heading: "Nasze propozycje",
    testBadge: "dane testowe",
    from: "od",
    minQuantity: (n: number) => `min. ${n} szt.`,
    pricingUnit: {
      piece: "za sztukę",
      portion: "za porcję",
      person: "za osobę",
    },
  },
  footer: {
    company: "La Palette Garden",
    addressLine: "Warszawa, Polska",
    legal: "Informacje prawne",
    terms: "Regulamin",
    privacy: "Polityka prywatności",
    rights: (year: number) => `© ${year} La Palette Garden. Wszelkie prawa zastrzeżone.`,
  },
  legal: {
    placeholder: "Treść w przygotowaniu.",
    termsTitle: "Regulamin",
    privacyTitle: "Polityka prywatności",
  },
  errors: {
    backendUnavailable: "Sklep jest chwilowo niedostępny",
    backendUnavailableHint: "Spróbuj odświeżyć stronę za chwilę.",
    retry: "Spróbuj ponownie",
  },
  allergens: {
    gluten: "Gluten",
    crustaceans: "Skorupiaki",
    eggs: "Jaja",
    fish: "Ryby",
    peanuts: "Orzeszki ziemne",
    soybeans: "Soja",
    milk: "Mleko",
    nuts: "Orzechy",
    celery: "Seler",
    mustard: "Gorczyca",
    sesame: "Sezam",
    sulphites: "Siarczyny",
    lupin: "Łubin",
    molluscs: "Mięczaki",
  },
} as const

export type Pl = typeof pl
