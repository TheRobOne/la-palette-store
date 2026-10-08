import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminStore, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import {
  MIN_ORDER_VALUE_METADATA_KEY,
  minOrderValueFromMetadata,
} from "../../lib/min-order-value"

/**
 * Settings → Store: the minimum order value (gross PLN) enforced when a
 * cart is completed and shown in the storefront cart. Stored in the store's
 * metadata (src/lib/order-rules.ts).
 */
const MinOrderValueWidget = ({ data: store }: DetailWidgetProps<AdminStore>) => {
  const [saved, setSaved] = useState(() =>
    minOrderValueFromMetadata(store.metadata)
  )
  const [value, setValue] = useState(String(saved))
  const [isSaving, setIsSaving] = useState(false)

  const parsed = Number(value.replace(",", "."))
  const isValid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0

  const save = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/admin/stores/${store.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { ...store.metadata, [MIN_ORDER_VALUE_METADATA_KEY]: parsed },
        }),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      setSaved(parsed)
      toast.success("Zapisano minimalną wartość zamówienia")
    } catch (e) {
      toast.error("Nie udało się zapisać", { description: String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Minimalna wartość zamówienia</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Kwota brutto produktów (bez dostawy), poniżej której sklep nie przyjmie
          zamówienia. Klient widzi ją w koszyku. 0 wyłącza limit.
        </Text>
      </div>
      <div className="flex items-end gap-3 px-6 py-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="min-order-value" size="small">
            Kwota (zł)
          </Label>
          <Input
            id="min-order-value"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!isValid}
          />
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={save}
          isLoading={isSaving}
          disabled={!isValid || parsed === saved}
        >
          Zapisz
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "store.details.after",
})

export default MinOrderValueWidget
