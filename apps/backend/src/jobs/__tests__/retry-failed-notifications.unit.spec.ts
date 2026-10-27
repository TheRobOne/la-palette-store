import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const deliverEmail = jest.fn()
jest.mock("../../modules/resend/deliver", () => ({
  ...jest.requireActual("../../modules/resend/deliver"),
  deliverEmail: (...args: unknown[]) => deliverEmail(...args),
}))

import { retryFailedNotifications } from "../retry-failed-notifications"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

function setup(failed: unknown[]) {
  const updateNotifications = jest.fn().mockResolvedValue({})
  const listNotifications = jest.fn().mockResolvedValue(failed)
  const services: Record<string, unknown> = {
    [Modules.NOTIFICATION]: { listNotifications, updateNotifications },
    [ContainerRegistrationKeys.LOGGER]: logger,
  }
  return {
    container: { resolve: (k: string) => services[k] } as never,
    listNotifications,
    updateNotifications,
  }
}

const failed = (id: string, attempts: number) => ({
  id,
  to: "klient@example.com",
  channel: "email",
  template: "order-confirmation",
  data: { _attempts: attempts },
  idempotency_key: `order-confirmation:${id}`,
})

describe("retryFailedNotifications (unit)", () => {
  beforeEach(() => jest.clearAllMocks())

  it("re-delivers failures of the last 24 h and marks them success on the same row", async () => {
    deliverEmail.mockResolvedValue({ id: "re_1" })
    const { container, listNotifications, updateNotifications } = setup([failed("noti_1", 1)])
    const now = new Date("2026-10-26T12:00:00.000Z")

    const result = await retryFailedNotifications(container, now)

    expect(listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
        created_at: { $gte: "2026-10-25T12:00:00.000Z" },
      }),
      expect.anything()
    )
    expect(deliverEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotency_key: "order-confirmation:noti_1" }),
      logger
    )
    expect(updateNotifications).toHaveBeenCalledWith({
      id: "noti_1",
      status: "success",
      external_id: "re_1",
      data: { _attempts: 2 },
    })
    expect(result.sent).toEqual(["noti_1"])
  })

  it("counts a failed attempt and stops after 5", async () => {
    deliverEmail.mockRejectedValue(new Error("Resend down"))
    const { container, updateNotifications } = setup([failed("noti_1", 2), failed("noti_2", 5)])

    const result = await retryFailedNotifications(container)

    expect(deliverEmail).toHaveBeenCalledTimes(1)
    expect(updateNotifications).toHaveBeenCalledWith({ id: "noti_1", data: { _attempts: 3 } })
    expect(result).toEqual({ sent: [], failed: ["noti_1"] })
  })
})
