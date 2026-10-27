import {
  FREE_DELIVERY_THRESHOLD_METADATA_KEY as KEY,
  freeDeliveryThresholdFromMetadata,
} from "../free-delivery-threshold"

describe("freeDeliveryThresholdFromMetadata (unit, no database)", () => {
  it.each([
    [{ [KEY]: 300 }, 300],
    [{ [KEY]: "300" }, 300],
    [{ [KEY]: "249,50" }, 249.5],
  ])("reads %j as %d", (metadata, expected) => {
    expect(freeDeliveryThresholdFromMetadata(metadata)).toEqual(expected)
  })

  it.each([null, undefined, {}, { [KEY]: "" }, { [KEY]: "abc" }, { [KEY]: 0 }, { [KEY]: -1 }])(
    "means no free delivery for %j",
    (metadata) => {
      expect(freeDeliveryThresholdFromMetadata(metadata)).toBeNull()
    }
  )
})
