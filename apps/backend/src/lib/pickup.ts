/**
 * Fulfillment setup names: in-person pickup at the venue and city delivery
 * (specs/007-delivery-zones). Names are the stable lookup keys used by
 * src/scripts/setup-pickup.ts and setup-delivery.ts; don't rename them in
 * the Admin.
 */
export const STOCK_LOCATION_NAME = "Kuchnia La Palette"
export const PICKUP_FULFILLMENT_SET_NAME = "Odbiór osobisty"
export const PICKUP_SERVICE_ZONE_NAME = "Lokal La Palette Garden"
export const PICKUP_SHIPPING_OPTION_NAME = "Odbiór osobisty"
/** `shipping_option.type.code` — lets the storefront recognise pickup options. */
export const PICKUP_OPTION_TYPE_CODE = "pickup"

export const DELIVERY_FULFILLMENT_SET_NAME = "Dostawa"
export const DELIVERY_SERVICE_ZONE_NAME = "Polska"
export const DELIVERY_SHIPPING_OPTION_NAME = "Dostawa"
/** `shipping_option.type.code` — lets the storefront recognise the delivery option. */
export const DELIVERY_OPTION_TYPE_CODE = "delivery"
/** `<identifier>_<id>` of src/modules/catering-delivery (medusa-config.ts). */
export const DELIVERY_PROVIDER_ID = "catering-delivery_catering-delivery"

export const VENUE_ADDRESS = {
  address_1: "ul. Gustawa Morcinka 40",
  postal_code: "31-762",
  city: "Kraków",
  country_code: "PL",
  phone: "+48 734 431 447",
}
