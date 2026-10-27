import { selectRequestsToRemind } from "../remind-staff-requests"

const now = new Date("2026-10-26T10:00:00.000Z")
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()

describe("selectRequestsToRemind (unit)", () => {
  it("selects undecided requests within the reminder window only", () => {
    const ids = selectRequestsToRemind(
      [
        { id: "soon", status: "requested", response_deadline: at(3) },
        { id: "edge", status: "requested", response_deadline: at(4) },
        { id: "later", status: "requested", response_deadline: at(5) },
        { id: "past", status: "requested", response_deadline: at(-1) },
        { id: "decided", status: "confirmed", response_deadline: at(2) },
        { id: "none", status: "requested", response_deadline: null },
      ],
      now,
      4
    )
    expect(ids).toEqual(["soon", "edge"])
  })
})
