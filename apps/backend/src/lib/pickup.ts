/**
 * In-person pickup at the venue — the only fulfillment at launch
 * (constitution: delivery zones are deferred). Names are the stable lookup
 * keys used by src/scripts/setup-pickup.ts; don't rename them in the Admin.
 */
export const STOCK_LOCATION_NAME = "Kuchnia La Palette"
export const PICKUP_FULFILLMENT_SET_NAME = "Odbiór osobisty"
export const PICKUP_SERVICE_ZONE_NAME = "Lokal La Palette Garden"
export const PICKUP_SHIPPING_OPTION_NAME = "Odbiór osobisty"
/** `shipping_option.type.code` — lets the storefront recognise pickup options. */
export const PICKUP_OPTION_TYPE_CODE = "pickup"

export const VENUE_ADDRESS = {
  address_1: "ul. Gustawa Morcinka 40",
  postal_code: "31-762",
  city: "Kraków",
  country_code: "PL",
  phone: "+48 734 431 447",
}
