import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminStore, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import {
  FREE_DELIVERY_THRESHOLD_METADATA_KEY,
  freeDeliveryThresholdFromMetadata,
} from "../../lib/free-delivery-threshold"
import {
  MIN_ORDER_VALUE_METADATA_KEY,
  minOrderValueFromMetadata,
} from "../../lib/min-order-value"

/**
 * Settings → Store: the minimum order value (gross PLN) enforced when a
 * cart is completed and shown in the storefront cart, and the optional
 * free-delivery threshold (specs/007-delivery-zones). Both are stored in the
 * store's metadata (src/lib/order-rules.ts, src/lib/free-delivery-threshold.ts).
 */
const MinOrderValueWidget = ({ data: store }: DetailWidgetProps<AdminStore>) => {
  // the metadata as last saved here, so one save never drops the other key
  const [metadata, setMetadata] = useState<Record<string, unknown>>(store.metadata ?? {})
  const saved = minOrderValueFromMetadata(metadata)
  const savedThreshold = freeDeliveryThresholdFromMetadata(metadata)
  const [value, setValue] = useState(String(saved))
  const [threshold, setThreshold] = useState(savedThreshold === null ? "" : String(savedThreshold))
  const [isSaving, setIsSaving] = useState(false)

  const parsed = Number(value.replace(",", "."))
  const isValid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0
  const parsedThreshold = threshold.trim() === "" ? null : Number(threshold.replace(",", "."))
  const isThresholdValid =
    parsedThreshold === null || (Number.isFinite(parsedThreshold) && parsedThreshold > 0)

  const saveMetadata = async (update: Record<string, unknown>, message: string) => {
    setIsSaving(true)
    try {
      const next = { ...metadata, ...update }
      const response = await fetch(`/admin/stores/${store.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: next }),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      setMetadata(next)
      toast.success(message)
    } catch (e) {
      toast.error("Nie udało się zapisać", { description: String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  const save = () =>
    saveMetadata({ [MIN_ORDER_VALUE_METADATA_KEY]: parsed }, "Zapisano minimalną wartość zamówienia")

  // "" removes the key in Medusa's metadata merge → no free delivery
  const saveThreshold = () =>
    saveMetadata(
      { [FREE_DELIVERY_THRESHOLD_METADATA_KEY]: parsedThreshold ?? "" },
      parsedThreshold === null ? "Wyłączono darmową dostawę" : "Zapisano próg darmowej dostawy"
    )

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
      <div className="px-6 py-4">
        <Heading level="h2">Darmowa dostawa</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Od tej kwoty brutto produktów dostawa w strefach jest bezpłatna. Puste pole —
          brak darmowej dostawy. Nie dotyczy dostaw poza strefami.
        </Text>
      </div>
      <div className="flex items-end gap-3 px-6 py-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="free-delivery-threshold" size="small">
            Darmowa dostawa od (zł)
          </Label>
          <Input
            id="free-delivery-threshold"
            type="number"
            min={0}
            step="0.01"
            placeholder="brak"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            aria-invalid={!isThresholdValid}
          />
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={saveThreshold}
          isLoading={isSaving}
          disabled={!isThresholdValid || parsedThreshold === savedThreshold}
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
