import { releasePickupBooking } from "../pickup-booking"

// T023a: the compensation of the completeCart `validate` hook removes the
// booking it created; a later-step failure cannot be forced reliably through
// the Store API with the system payment provider.
describe("releasePickupBooking (unit, no database)", () => {
  const containerWith = (deleteBookings: jest.Mock) =>
    ({ resolve: jest.fn().mockReturnValue({ deleteBookings }) }) as never

  it("deletes the booking created by the hook", async () => {
    const deleteBookings = jest.fn()
    await releasePickupBooking("bkg_123", containerWith(deleteBookings))
    expect(deleteBookings).toHaveBeenCalledWith("bkg_123")
  })

  it("does nothing when the hook created no booking", async () => {
    const deleteBookings = jest.fn()
    await releasePickupBooking(undefined, containerWith(deleteBookings))
    expect(deleteBookings).not.toHaveBeenCalled()
  })
})
