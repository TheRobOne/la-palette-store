import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261014192114 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "booking" drop constraint if exists "booking_status_check";`);

    this.addSql(`alter table if exists "booking" add column if not exists "requires_confirmation" boolean not null default false, add column if not exists "response_deadline" timestamptz null, add column if not exists "payment_deadline" timestamptz null, add column if not exists "decided_at" timestamptz null, add column if not exists "decided_by" text null, add column if not exists "request_snapshot" jsonb null;`);
    this.addSql(`alter table if exists "booking" add constraint "booking_status_check" check("status" in ('requested', 'confirmed', 'active', 'declined', 'expired', 'canceled'));`);

    this.addSql(`alter table if exists "fulfillment_schedule" add column if not exists "request_lead_time_hours" integer not null default 72, add column if not exists "request_response_hours" integer not null default 24, add column if not exists "request_payment_hours" integer not null default 24;`);

    this.addSql(`alter table if exists "window_rule" add column if not exists "requires_confirmation" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "booking" drop constraint if exists "booking_status_check";`);

    this.addSql(`alter table if exists "booking" drop column if exists "requires_confirmation", drop column if exists "response_deadline", drop column if exists "payment_deadline", drop column if exists "decided_at", drop column if exists "decided_by", drop column if exists "request_snapshot";`);

    this.addSql(`alter table if exists "booking" add constraint "booking_status_check" check("status" in ('active', 'canceled'));`);

    this.addSql(`alter table if exists "fulfillment_schedule" drop column if exists "request_lead_time_hours", drop column if exists "request_response_hours", drop column if exists "request_payment_hours";`);

    this.addSql(`alter table if exists "window_rule" drop column if exists "requires_confirmation";`);
  }

}
