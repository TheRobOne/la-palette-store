import { escapeHtml, formatAmount, formatDate, formatDeadline, formatWindow } from "../format"

describe("e-mail formatting (unit)", () => {
  it("formats calendar dates with the Polish weekday", () => {
    expect(formatDate("2026-10-23")).toBe("pt 23.10.2026")
    expect(formatDate("2026-10-26")).toBe("pon. 26.10.2026")
    expect(formatDate("2026-10-25")).toBe("niedz. 25.10.2026")
  })

  it("formats windows", () => {
    expect(formatWindow("10:00", "11:00")).toBe("10:00–11:00")
  })

  it("shows deadlines in Warsaw time, across the DST change", () => {
    // CEST (UTC+2) before 2026-10-25 03:00, CET (UTC+1) after
    expect(formatDeadline("2026-10-24T12:30:00.000Z")).toBe("sob. 24.10, 14:30")
    expect(formatDeadline("2026-10-25T12:30:00.000Z")).toBe("niedz. 25.10, 13:30")
    expect(formatDeadline("2026-10-25T22:15:00.000Z")).toBe("niedz. 25.10, 23:15")
    // crosses midnight in Warsaw only
    expect(formatDeadline("2026-10-25T23:30:00.000Z")).toBe("pon. 26.10, 00:30")
  })

  it("formats amounts in złoty", () => {
    expect(formatAmount(144)).toBe("144,00 zł")
    expect(formatAmount(1234.5)).toBe("1 234,50 zł")
    expect(formatAmount(0)).toBe("0,00 zł")
  })

  it("escapes HTML", () => {
    expect(escapeHtml(`<b>"Ala" & 'Ola'</b>`)).toBe(
      "&lt;b&gt;&quot;Ala&quot; &amp; &#39;Ola&#39;&lt;/b&gt;"
    )
    expect(escapeHtml(null)).toBe("")
  })
})
