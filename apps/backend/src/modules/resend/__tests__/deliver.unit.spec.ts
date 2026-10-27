import { deliverEmail, emailOptionsFromEnv, isAllowedRecipient } from "../deliver"

const data = {
  term: { date: "2026-10-30", start: "10:00", end: "11:00" },
  items: [],
  total: 0,
  pickup_address: { address_1: "ul. X 1", postal_code: "30-001", city: "Kraków", phone: null },
  contact: { name: null, email: null, phone: null },
  invoice: null,
  notes: null,
  links: { terms: "https://x/regulamin", shop: "https://x/catering", admin: "https://y/app" },
  order_id: "order_1",
  display_id: 1,
}

const email = { to: "klient@example.com", template: "order-confirmation", data, idempotency_key: "k1" }
const logger = { info: jest.fn() }

const fakeClient = (result: { data: { id: string } | null; error: { message: string } | null }) => {
  const send = jest.fn().mockResolvedValue(result)
  return { client: { emails: { send } } as never, send }
}

const options = (overrides = {}) => ({
  api_key: "re_test",
  from: "La Palette Garden – Catering <catering@lapalettegarden.pl>",
  reply_to: "kontakt@lapalettegarden.pl",
  app_env: "staging",
  allowlist: ["team@example.com", "@lapalettegarden.pl"],
  ...overrides,
})

describe("Resend delivery (unit)", () => {
  beforeEach(() => logger.info.mockClear())

  it("allows anyone in production and only the allow-list elsewhere", () => {
    expect(isAllowedRecipient("klient@example.com", options({ app_env: "production" }))).toBe(true)
    expect(isAllowedRecipient("klient@example.com", options())).toBe(false)
    expect(isAllowedRecipient("Team@Example.com", options())).toBe(true)
    expect(isAllowedRecipient("kuchnia@lapalettegarden.pl", options())).toBe(true)
    expect(isAllowedRecipient("x@notlapalettegarden.pl", options())).toBe(false)
  })

  it("only logs without an API key", async () => {
    const result = await deliverEmail(options({ api_key: undefined }), email, logger, null)
    expect(result).toEqual({ id: "logged" })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("[e-mail logged] order-confirmation"))
  })

  it("suppresses recipients outside the allow-list without calling Resend", async () => {
    const { client, send } = fakeClient({ data: { id: "x" }, error: null })
    expect(await deliverEmail(options(), email, logger, client)).toEqual({ id: "suppressed" })
    expect(send).not.toHaveBeenCalled()
  })

  it("sends html + text with reply-to and the idempotency key", async () => {
    const { client, send } = fakeClient({ data: { id: "re_123" }, error: null })
    const result = await deliverEmail(options({ app_env: "production" }), email, logger, client)
    expect(result).toEqual({ id: "re_123" })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "La Palette Garden – Catering <catering@lapalettegarden.pl>",
        to: "klient@example.com",
        replyTo: "kontakt@lapalettegarden.pl",
        subject: "Potwierdzenie zamówienia nr 1",
        html: expect.stringContaining("<html"),
        text: expect.stringContaining("Razem"),
      }),
      { idempotencyKey: "k1" }
    )
  })

  it("throws on a Resend error so the notification is recorded as failure", async () => {
    const { client } = fakeClient({ data: null, error: { message: "Invalid API key" } })
    await expect(
      deliverEmail(options({ app_env: "production" }), email, logger, client)
    ).rejects.toThrow("Resend: Invalid API key")
  })

  it("reads options from the environment", () => {
    expect(
      emailOptionsFromEnv({
        RESEND_API_KEY: "",
        APP_ENV: "staging",
        NOTIFICATION_ALLOWLIST: " a@x.pl, @y.pl ,",
      } as NodeJS.ProcessEnv)
    ).toEqual({
      api_key: undefined,
      from: "La Palette Garden – Catering <catering@lapalettegarden.pl>",
      reply_to: undefined,
      app_env: "staging",
      allowlist: ["a@x.pl", "@y.pl"],
    })
  })
})
