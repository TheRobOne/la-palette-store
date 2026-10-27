import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Table,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { adminFetch, AdminApiError } from "../../../lib/catering-api"
import { parsePostalCodeList } from "../../../../modules/catering/delivery/postal-code"

type DeliveryZone = {
  id: string
  name: string
  price: number
  min_order_value: number | null
  postal_codes: string[]
}

type Form = {
  id?: string
  name: string
  price: string
  min_order_value: string
  postal_codes: string
}

const EMPTY_FORM: Form = { name: "", price: "", min_order_value: "", postal_codes: "" }

const formatPln = (amount: number) => `${amount.toFixed(2).replace(".", ",")} zł`
const parseAmount = (value: string) => Number(value.replace(",", "."))

const toForm = (zone: DeliveryZone): Form => ({
  id: zone.id,
  name: zone.name,
  price: String(zone.price),
  min_order_value: zone.min_order_value === null ? "" : String(zone.min_order_value),
  postal_codes: zone.postal_codes.join("\n"),
})

/**
 * Settings → "Strefy dostawy": delivery zones as lists of full postal codes
 * with a gross price and an optional minimum order value
 * (specs/007-delivery-zones US2, contracts/admin-api.md). Codes are pasted as
 * a list (commas, spaces or new lines); the server names invalid entries and
 * codes that already belong to another zone. Changes apply to the next cart.
 */
const DeliveryZonesPage = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [check, setCheck] = useState("")
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const prompt = usePrompt()

  const load = useCallback(async () => {
    try {
      const { delivery_zones } = await adminFetch<{ delivery_zones: DeliveryZone[] }>(
        "/admin/catering/delivery-zones"
      )
      setZones(delivery_zones)
    } catch (e) {
      toast.error("Nie udało się wczytać stref", { description: String(e) })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pasted = form ? parsePostalCodeList(form.postal_codes) : { valid: [], invalid: [] }
  const price = form ? parseAmount(form.price) : NaN
  const minimum = form && form.min_order_value.trim() !== "" ? parseAmount(form.min_order_value) : null
  const isValid =
    !!form &&
    form.name.trim() !== "" &&
    form.price.trim() !== "" &&
    Number.isFinite(price) &&
    price >= 0 &&
    (minimum === null || (Number.isFinite(minimum) && minimum >= 0)) &&
    pasted.valid.length > 0

  const save = async () => {
    if (!form) {
      return
    }
    setSaving(true)
    try {
      await adminFetch(
        form.id ? `/admin/catering/delivery-zones/${form.id}` : "/admin/catering/delivery-zones",
        {
          method: "POST",
          body: {
            name: form.name.trim(),
            price,
            min_order_value: minimum,
            // invalid entries are sent too, so the server names them
            postal_codes: [...pasted.valid, ...pasted.invalid],
          },
        }
      )
      toast.success(form.id ? "Zapisano strefę" : "Dodano strefę")
      setForm(null)
      await load()
    } catch (e) {
      toast.error("Nie udało się zapisać strefy", {
        description: e instanceof AdminApiError ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (zone: DeliveryZone) => {
    const confirmed = await prompt({
      title: `Usunąć strefę „${zone.name}”?`,
      description:
        "Jej kody pocztowe trafią na ścieżkę „na zapytanie”. Złożone zamówienia zostają bez zmian.",
      confirmText: "Usuń",
      cancelText: "Anuluj",
    })
    if (!confirmed) {
      return
    }
    try {
      await adminFetch(`/admin/catering/delivery-zones/${zone.id}`, { method: "DELETE" })
      toast.success("Usunięto strefę")
      await load()
    } catch (e) {
      toast.error("Nie udało się usunąć strefy", { description: String(e) })
    }
  }

  const checkCode = async () => {
    try {
      const result = await adminFetch<{
        postal_code: string
        valid: boolean
        zone: { name: string } | null
      }>(`/admin/catering/delivery-zones/match?postal_code=${encodeURIComponent(check)}`)
      setCheckResult(
        !result.valid
          ? "Nieprawidłowy kod — użyj formatu XX-XXX."
          : result.zone
            ? `${result.postal_code}: ${result.zone.name}`
            : `${result.postal_code}: poza strefami (dostawa na zapytanie)`
      )
    } catch (e) {
      setCheckResult(String(e))
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Strefy dostawy</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Strefa to lista pełnych kodów pocztowych (XX-XXX) z ceną dostawy brutto. Kod spoza
            wszystkich stref idzie „na zapytanie” — kuchnia potwierdza i podaje koszt dostawy.
          </Text>
        </div>
        {!form && (
          <Button size="small" variant="secondary" onClick={() => setForm(EMPTY_FORM)}>
            Dodaj strefę
          </Button>
        )}
      </div>

      {form && (
        <div className="flex flex-col gap-y-3 px-6 py-4">
          <Heading level="h2">{form.id ? `Edycja: ${form.name}` : "Nowa strefa"}</Heading>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="zone-name" size="small">
                Nazwa
              </Label>
              <Input
                id="zone-name"
                size="small"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="zone-price" size="small">
                Cena dostawy (zł brutto)
              </Label>
              <Input
                id="zone-price"
                size="small"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="zone-minimum" size="small">
                Minimalna wartość zamówienia (zł, opcjonalnie)
              </Label>
              <Input
                id="zone-minimum"
                size="small"
                type="number"
                min={0}
                step="0.01"
                placeholder="jak dla całego sklepu"
                value={form.min_order_value}
                onChange={(e) => setForm({ ...form, min_order_value: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="zone-codes" size="small">
              Kody pocztowe (wklej listę — przecinki, spacje lub nowe linie)
            </Label>
            <Textarea
              id="zone-codes"
              rows={8}
              value={form.postal_codes}
              onChange={(e) => setForm({ ...form, postal_codes: e.target.value })}
            />
            <Text size="small" className="text-ui-fg-subtle">
              Poprawnych kodów: {pasted.valid.length}
              {pasted.invalid.length > 0 && (
                <span className="text-ui-fg-error">
                  {" "}
                  · nieprawidłowe: {pasted.invalid.join(", ")}
                </span>
              )}
            </Text>
          </div>
          <div className="flex justify-end gap-x-2">
            <Button size="small" variant="transparent" onClick={() => setForm(null)}>
              Anuluj
            </Button>
            <Button size="small" disabled={!isValid} isLoading={saving} onClick={save}>
              Zapisz
            </Button>
          </div>
        </div>
      )}

      <div className="px-6 py-4">
        {zones.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            Brak stref — każda dostawa idzie „na zapytanie”.
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Strefa</Table.HeaderCell>
                <Table.HeaderCell>Cena</Table.HeaderCell>
                <Table.HeaderCell>Minimum</Table.HeaderCell>
                <Table.HeaderCell>Kody</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {zones.map((zone) => (
                <Table.Row key={zone.id}>
                  <Table.Cell>{zone.name}</Table.Cell>
                  <Table.Cell>{formatPln(zone.price)}</Table.Cell>
                  <Table.Cell>
                    {zone.min_order_value === null ? "—" : formatPln(zone.min_order_value)}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall">{zone.postal_codes.length}</Badge>{" "}
                    <span className="text-ui-fg-subtle">
                      {zone.postal_codes.slice(0, 4).join(", ")}
                      {zone.postal_codes.length > 4 ? ", …" : ""}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button size="small" variant="transparent" onClick={() => setForm(toForm(zone))}>
                      Edytuj
                    </Button>
                    <Button size="small" variant="transparent" onClick={() => remove(zone)}>
                      Usuń
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <div className="flex items-end gap-3 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="zone-check" size="small">
            Sprawdź kod pocztowy
          </Label>
          <Input
            id="zone-check"
            size="small"
            placeholder="31-762"
            value={check}
            onChange={(e) => {
              setCheck(e.target.value)
              setCheckResult(null)
            }}
          />
        </div>
        <Button size="small" variant="secondary" disabled={!check.trim()} onClick={checkCode}>
          Sprawdź
        </Button>
        {checkResult && <Text size="small">{checkResult}</Text>}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Strefy dostawy",
})

export default DeliveryZonesPage
