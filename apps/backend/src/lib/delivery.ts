import type { BigNumberInput, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import { type DeliveryQuote, quoteDelivery, type ZoneForQuote } from "../modules/catering/delivery/quote"
import type CateringModuleService from "../modules/catering/service"
import { freeDeliveryThresholdFromMetadata } from "./free-delivery-threshold"
import { minOrderValueFromMetadata } from "./min-order-value"

/**
 * Loads what the pure delivery quote needs (specs/007-delivery-zones
 * research R-02, R-07) — shared by the quote route, the pricing hook and the
 * completion checks so all three price a cart the same way.
 */

/** bigNumber columns come back as numbers or BigNumber-like values. */
const toNumber = (value: unknown): number => MathBN.convert(value as BigNumberInput).toNumber()

export async function loadDeliveryZones(container: MedusaContainer): Promise<ZoneForQuote[]> {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const zones = await catering.listDeliveryZones({}, { relations: ["codes"], order: { name: "ASC" } })
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    price: toNumber(zone.price),
    min_order_value: zone.min_order_value === null ? null : toNumber(zone.min_order_value),
    codes: (zone.codes ?? []).map((c) => c.code).sort(),
  }))
}

/** Free-delivery threshold and global minimum from the (single) store's metadata. */
export async function loadStoreDeliveryRules(
  container: MedusaContainer
): Promise<{ freeThreshold: number | null; globalMinimum: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({ entity: "store", fields: ["id", "metadata"] })
  const metadata = stores[0]?.metadata
  return {
    freeThreshold: freeDeliveryThresholdFromMetadata(metadata),
    globalMinimum: minOrderValueFromMetadata(metadata),
  }
}

/**
 * The cart's staff-confirmed out-of-zone request (spec 007 US3): its postal
 * code and cost, or null. Only out-of-zone requests (sent without a zone)
 * count — an in-zone request's cost is the zone price recorded at sending,
 * not a price staff agreed.
 */
export async function loadConfirmedDelivery(
  container: MedusaContainer,
  cartId: string
): Promise<{ postal_code: string; cost: number } | null> {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const [booking] = await catering.listBookings(
    {
      cart_id: cartId,
      requires_confirmation: true,
      fulfillment_method: "delivery",
      delivery_zone_id: null,
      status: ["confirmed", "active"],
    },
    { order: { created_at: "DESC" }, take: 1 }
  )
  if (
    !booking?.delivery_postal_code ||
    booking.delivery_cost === null ||
    booking.delivery_cost === undefined
  ) {
    return null
  }
  return { postal_code: booking.delivery_postal_code, cost: toNumber(booking.delivery_cost) }
}

export async function quoteForPostalCode(
  container: MedusaContainer,
  postalCode: unknown,
  { itemTotal = 0, cartId }: { itemTotal?: BigNumberInput | null; cartId?: string } = {}
): Promise<DeliveryQuote> {
  const [zones, rules, confirmed] = await Promise.all([
    loadDeliveryZones(container),
    loadStoreDeliveryRules(container),
    cartId ? loadConfirmedDelivery(container, cartId) : Promise.resolve(null),
  ])
  return quoteDelivery({
    postalCode,
    itemTotal: toNumber(itemTotal ?? 0),
    zones,
    freeThreshold: rules.freeThreshold,
    globalMinimum: rules.globalMinimum,
    confirmed,
  })
}

export type CartForQuote = {
  id: string
  item_total?: BigNumberInput | null
  shipping_address?: { postal_code?: string | null } | null
}

export function quoteForCart(container: MedusaContainer, cart: CartForQuote): Promise<DeliveryQuote> {
  return quoteForPostalCode(container, cart.shipping_address?.postal_code, {
    itemTotal: cart.item_total,
    cartId: cart.id,
  })
}

/** Admin shape of a zone (specs/007-delivery-zones contracts/admin-api.md). */
export function deliveryZoneDto(zone: ZoneForQuote) {
  return {
    id: zone.id,
    name: zone.name,
    price: zone.price,
    min_order_value: zone.min_order_value,
    postal_codes: zone.codes,
  }
}

export async function loadDeliveryZoneDto(container: MedusaContainer, id: string) {
  const zone = (await loadDeliveryZones(container)).find((z) => z.id === id)
  return zone ? deliveryZoneDto(zone) : null
}
