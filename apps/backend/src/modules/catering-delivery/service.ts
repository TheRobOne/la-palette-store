import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  FulfillmentOption,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"

/** Context key set by src/workflows/hooks/delivery-pricing-context.ts. */
export const DELIVERY_AMOUNT_CONTEXT_KEY = "catering_delivery_amount"

/**
 * The delivery amount the pricing hook computed, or 0 when there is none
 * (no postal code yet, invalid code, out of zone without a staff price).
 * Never throws: Medusa prices all options of a cart together, so a throw
 * would also hide pickup (specs/007-delivery-zones research R-02). The amount
 * is enforced when the cart is completed.
 */
export function deliveryAmountFromContext(context: Record<string, unknown> | undefined): number {
  const amount = context?.[DELIVERY_AMOUNT_CONTEXT_KEY]
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : 0
}

/**
 * City delivery: one calculated shipping option whose price comes from our
 * postal-code zones. The provider itself cannot read the catering module (a
 * module provider sees only its own container), so the price arrives in the
 * pricing context. Nothing is sent anywhere on fulfillment — the venue's own
 * driver delivers.
 */
export class CateringDeliveryFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "catering-delivery"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "delivery" }]
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    _optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    return {
      calculated_amount: deliveryAmountFromContext(context as Record<string, unknown>),
      // zone prices are gross PLN, like the region's prices
      is_calculated_price_tax_inclusive: true,
    }
  }

  async createFulfillment() {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment() {
    return {}
  }

  async createReturnFulfillment() {
    return { data: {}, labels: [] }
  }
}
