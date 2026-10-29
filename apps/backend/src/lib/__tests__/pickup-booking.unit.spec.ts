import { releasePickupBooking } from "../pickup-booking"

// T023a: the compensation of the completeCart `validate` hook removes the
// booking it created; a later-step failure cannot be forced reliably through
// the Store API with the system payment provider.
describe("releasePickupBooking (unit, no database)", () => {
  const containerWith = (service: Record<string, jest.Mock>) =>
    ({ resolve: jest.fn().mockReturnValue(service) }) as never

  it("deletes the booking created by the hook", async () => {
    const deleteBookings = jest.fn()
    await releasePickupBooking({ created: "bkg_123" }, containerWith({ deleteBookings }))
    expect(deleteBookings).toHaveBeenCalledWith("bkg_123")
  })

  it("restores the requests a standard completion superseded", async () => {
    const deleteBookings = jest.fn()
    const updateBookings = jest.fn()
    const superseded = [{ id: "bkg_req", status: "confirmed" as const }]
    await releasePickupBooking(
      { created: "bkg_123", superseded },
      containerWith({ deleteBookings, updateBookings })
    )
    expect(deleteBookings).toHaveBeenCalledWith("bkg_123")
    expect(updateBookings).toHaveBeenCalledWith(superseded)
  })

  it("returns a paid request to confirmed (spec 005)", async () => {
    const updateBookings = jest.fn()
    await releasePickupBooking(
      { revert: { id: "bkg_456", status: "confirmed" } },
      containerWith({ updateBookings })
    )
    expect(updateBookings).toHaveBeenCalledWith({ id: "bkg_456", status: "confirmed" })
  })

  it("does nothing when the hook changed no booking", async () => {
    const deleteBookings = jest.fn()
    const updateBookings = jest.fn()
    await releasePickupBooking(undefined, containerWith({ deleteBookings, updateBookings }))
    expect(deleteBookings).not.toHaveBeenCalled()
    expect(updateBookings).not.toHaveBeenCalled()
  })
})
