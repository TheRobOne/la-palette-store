import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminPromotion, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { minOrderValueFromMetadata } from "../../lib/min-order-value"

const formatPln = (value: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value)

/**
 * Promotion page: the minimum cart value of a discount code
 * (apps/backend/AGENTS.md "Discount codes"). Stored as a promotion rule the standard
 * "Conditions" section does not show (src/lib/promotion-min-order-value.ts).
 */
const PromotionMinOrderValueWidget = ({ data: promotion }: DetailWidgetProps<AdminPromotion>) => {
  const [saved, setSaved] = useState<number | null | undefined>(undefined)
  const [value, setValue] = useState("")
  const [storeMinimum, setStoreMinimum] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch(`/admin/catering/promotions/${promotion.id}/min-order-value`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ min_order_value }: { min_order_value: number | null }) => {
        setSaved(min_order_value)
        setValue(min_order_value === null ? "" : String(min_order_value))
      })
      .catch((e) => toast.error("Nie udało się wczytać minimalnej kwoty", { description: String(e) }))
    fetch(`/admin/stores?fields=metadata`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body && setStoreMinimum(minOrderValueFromMetadata(body.stores?.[0]?.metadata)))
      .catch(() => undefined)
  }, [promotion.id])

  const parsed = value.trim() === "" ? null : Number(value.replace(",", "."))
  const isValid = parsed === null || (Number.isFinite(parsed) && parsed > 0)
  const tooLow = parsed !== null && storeMinimum !== null && parsed <= storeMinimum

  const save = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/admin/catering/promotions/${promotion.id}/min-order-value`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_order_value: parsed }),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      setSaved(parsed)
      toast.success(parsed === null ? "Usunięto minimalną kwotę" : "Zapisano minimalną kwotę")
    } catch (e) {
      toast.error("Nie udało się zapisać", { description: String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  // discount codes: amounts are gross; new promotions get it from src/workflows/hooks/promotions-created.ts
  const isNet = promotion.application_method?.type === "fixed" && promotion.is_tax_inclusive === false

  return (
    <Container className="divide-y p-0">
      {isNet && (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            Kwota rabatu jest ustawiona jako netto — klient dostanie o VAT więcej (np. 21,60 zł
            zamiast 20 zł). Włącz „Tax inclusive” w edycji szczegółów promocji.
          </Text>
        </div>
      )}
      <div className="px-6 py-4">
        <Heading level="h2">Minimalna wartość koszyka</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Kod działa od tej kwoty brutto produktów (przed rabatem, bez dostawy). Ustaw ją
          wyraźnie powyżej minimum zamówienia
          {storeMinimum !== null ? ` (${formatPln(storeMinimum)})` : ""}, np. równowartość
          trzech boksów, gdy minimum to dwa. Puste pole — kod działa od każdej kwoty.
        </Text>
      </div>
      <div className="flex flex-col gap-2 px-6 py-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="promotion-min-order-value" size="small">
              Kod działa od (zł)
            </Label>
            <Input
              id="promotion-min-order-value"
              type="number"
              min={0}
              step="0.01"
              placeholder="każda kwota"
              value={value}
              disabled={saved === undefined}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!isValid}
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={save}
            isLoading={isSaving}
            disabled={saved === undefined || !isValid || parsed === saved}
          >
            Zapisz
          </Button>
        </div>
        {tooLow && (
          <Text size="small" className="text-ui-fg-error">
            Kwota nie przekracza minimum zamówienia — po rabacie koszyk może spaść poniżej
            minimum i klient nie złoży zamówienia.
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "promotion.details.side.after",
})

export default PromotionMinOrderValueWidget
