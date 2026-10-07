import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CATERING_MODULE } from "../modules/catering"
import type { FulfillmentMethod } from "../modules/catering/models/fulfillment-schedule"
import type CateringModuleService from "../modules/catering/service"
import { assertValidSchedule, type ScheduleInput } from "../modules/catering/scheduling/validate-schedule"

export type UpdatePickupScheduleInput = ScheduleInput & { method: FulfillmentMethod }

type Snapshot = {
  settings: { id: string; daily_capacity: number } | null
  schedule: {
    id: string
    is_enabled: boolean
    lead_time_hours: number
    booking_horizon_days: number
  } | null
  windows: { weekday: number; start_time: string; end_time: string }[]
  createdSettingsId?: string
  createdScheduleId?: string
}

/**
 * Replaces a method's schedule as a whole (contracts/admin-api.md Schedule):
 * settings (kitchen-wide capacity), the method's lead time/horizon/enabled
 * flag and its window list. Compensation restores the previous values.
 */
const updatePickupScheduleStep = createStep(
  "update-pickup-schedule",
  async (input: UpdatePickupScheduleInput, { container }) => {
    assertValidSchedule(input)
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)

    const [[settings], [schedule], windows] = await Promise.all([
      catering.listSchedulingSettings({}, { take: 1 }),
      catering.listFulfillmentSchedules({ fulfillment_method: input.method }),
      catering.listWindowRules({ fulfillment_method: input.method }),
    ])
    const snapshot: Snapshot = {
      settings: settings ? { id: settings.id, daily_capacity: settings.daily_capacity } : null,
      schedule: schedule
        ? {
            id: schedule.id,
            is_enabled: schedule.is_enabled,
            lead_time_hours: schedule.lead_time_hours,
            booking_horizon_days: schedule.booking_horizon_days,
          }
        : null,
      windows: windows.map((w) => ({
        weekday: w.weekday,
        start_time: w.start_time,
        end_time: w.end_time,
      })),
    }

    if (settings) {
      await catering.updateSchedulingSettings({ id: settings.id, daily_capacity: input.daily_capacity })
    } else {
      const created = await catering.createSchedulingSettings({ daily_capacity: input.daily_capacity })
      snapshot.createdSettingsId = created.id
    }

    const scheduleData = {
      is_enabled: input.is_enabled,
      lead_time_hours: input.lead_time_hours,
      booking_horizon_days: input.booking_horizon_days,
    }
    if (schedule) {
      await catering.updateFulfillmentSchedules({ id: schedule.id, ...scheduleData })
    } else {
      const created = await catering.createFulfillmentSchedules({
        fulfillment_method: input.method,
        ...scheduleData,
      })
      snapshot.createdScheduleId = created.id
    }

    if (windows.length) {
      await catering.deleteWindowRules(windows.map((w) => w.id))
    }
    if (input.windows.length) {
      await catering.createWindowRules(
        input.windows.map((w) => ({
          fulfillment_method: input.method,
          weekday: w.weekday,
          start_time: w.start,
          end_time: w.end,
        }))
      )
    }

    return new StepResponse(undefined, { method: input.method, snapshot })
  },
  async (data, { container }) => {
    if (!data) {
      return
    }
    const { method, snapshot } = data
    const catering: CateringModuleService = container.resolve(CATERING_MODULE)

    if (snapshot.settings) {
      await catering.updateSchedulingSettings(snapshot.settings)
    } else if (snapshot.createdSettingsId) {
      await catering.deleteSchedulingSettings(snapshot.createdSettingsId)
    }
    if (snapshot.schedule) {
      await catering.updateFulfillmentSchedules(snapshot.schedule)
    } else if (snapshot.createdScheduleId) {
      await catering.deleteFulfillmentSchedules(snapshot.createdScheduleId)
    }
    const current = await catering.listWindowRules({ fulfillment_method: method })
    if (current.length) {
      await catering.deleteWindowRules(current.map((w) => w.id))
    }
    if (snapshot.windows.length) {
      await catering.createWindowRules(
        snapshot.windows.map((w) => ({ fulfillment_method: method, ...w }))
      )
    }
  }
)

export const updatePickupScheduleWorkflow = createWorkflow(
  "update-pickup-schedule",
  (input: UpdatePickupScheduleInput) => {
    updatePickupScheduleStep(input)
    return new WorkflowResponse(undefined)
  }
)
