import { quoteDelivery, type QuoteInputs } from "../quote"

const zones = [
  { id: "dzone_1", name: "Strefa 1", price: 30, min_order_value: null, codes: ["31-762", "32-005"] },
  { id: "dzone_2", name: "Strefa 2", price: 50, min_order_value: 200, codes: ["30-001"] },
]

const inputs = (overrides: Partial<QuoteInputs> = {}): QuoteInputs => ({
  postalCode: "31-762",
  itemTotal: 150,
  zones,
  freeThreshold: null,
  globalMinimum: 100,
  ...overrides,
})

describe("quoteDelivery", () => {
  it("prices a code in a zone", () => {
    expect(quoteDelivery(inputs())).toEqual({
      status: "in_zone",
      postal_code: "31-762",
      zone: { id: "dzone_1", name: "Strefa 1" },
      amount: 30,
      min_order_value: 100,
      requires_confirmation: false,
    })
    expect(quoteDelivery(inputs({ postalCode: "32-005" })).zone?.name).toBe("Strefa 1")
  })

  it("makes delivery free from the threshold (inclusive)", () => {
    expect(quoteDelivery(inputs({ freeThreshold: 300, itemTotal: 299.99 })).amount).toBe(30)
    expect(quoteDelivery(inputs({ freeThreshold: 300, itemTotal: 300 })).amount).toBe(0)
  })

  it("applies the higher of the global and the zone minimum", () => {
    expect(quoteDelivery(inputs({ postalCode: "30-001" })).min_order_value).toBe(200)
    const lowZone = [{ ...zones[0], min_order_value: 50 }]
    expect(quoteDelivery(inputs({ zones: lowZone })).min_order_value).toBe(100)
  })

  it("sends a code outside every zone to confirmation", () => {
    const quote = quoteDelivery(inputs({ postalCode: "34-500" }))
    expect(quote).toMatchObject({ status: "out_of_zone", amount: null, requires_confirmation: true })
    const confirmed = { postal_code: "34-500", cost: 80 }
    expect(quoteDelivery(inputs({ postalCode: "34-500", confirmed })).amount).toBe(80)
  })

  it("keeps a confirmed out-of-zone cost for its code only, even once the code is in a zone", () => {
    const confirmed = { postal_code: "31-762", cost: 80 }
    expect(quoteDelivery(inputs({ confirmed }))).toMatchObject({
      status: "out_of_zone",
      zone: null,
      amount: 80,
      requires_confirmation: true,
    })
    // another code: the request does not apply
    expect(quoteDelivery(inputs({ postalCode: "32-005", confirmed }))).toMatchObject({
      status: "in_zone",
      amount: 30,
    })
    expect(
      quoteDelivery(inputs({ postalCode: "34-501", confirmed: { postal_code: "34-500", cost: 80 } }))
        .amount
    ).toBeNull()
  })

  it("does not apply free delivery to out-of-zone requests", () => {
    const quote = quoteDelivery(inputs({
        postalCode: "34-500",
        freeThreshold: 1,
        confirmed: { postal_code: "34-500", cost: 80 },
      }))
    expect(quote.amount).toBe(80)
  })

  it("does not price an invalid code", () => {
    expect(quoteDelivery(inputs({ postalCode: "31762" }))).toMatchObject({
      status: "invalid",
      amount: null,
      requires_confirmation: false,
    })
  })
})
