import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006192941 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "fulfillment_schedule" drop constraint if exists "fulfillment_schedule_fulfillment_method_unique";`);
    this.addSql(`alter table if exists "blocked_date" drop constraint if exists "blocked_date_date_method_unique";`);
    this.addSql(`create table if not exists "blocked_date" ("id" text not null, "date" text not null, "fulfillment_method" text check ("fulfillment_method" in ('pickup')) null, "reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blocked_date_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blocked_date_deleted_at" ON "blocked_date" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blocked_date_date_method_unique" ON "blocked_date" ("date", "fulfillment_method") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "booking" ("id" text not null, "cart_id" text not null, "order_id" text null, "fulfillment_method" text check ("fulfillment_method" in ('pickup')) not null, "date" text not null, "start_time" text not null, "end_time" text not null, "status" text check ("status" in ('active', 'canceled')) not null default 'active', "previous_date" text null, "previous_start_time" text null, "previous_end_time" text null, "rescheduled_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_deleted_at" ON "booking" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_date" ON "booking" ("date") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_cart_id" ON "booking" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_order_id" ON "booking" ("order_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "fulfillment_schedule" ("id" text not null, "fulfillment_method" text check ("fulfillment_method" in ('pickup')) not null, "is_enabled" boolean not null default true, "lead_time_hours" integer not null default 48, "booking_horizon_days" integer not null default 60, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fulfillment_schedule_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_schedule_fulfillment_method_unique" ON "fulfillment_schedule" ("fulfillment_method") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fulfillment_schedule_deleted_at" ON "fulfillment_schedule" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "scheduling_settings" ("id" text not null, "daily_capacity" integer not null default 10, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "scheduling_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_scheduling_settings_deleted_at" ON "scheduling_settings" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "window_rule" ("id" text not null, "fulfillment_method" text check ("fulfillment_method" in ('pickup')) not null, "weekday" integer not null, "start_time" text not null, "end_time" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "window_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_window_rule_deleted_at" ON "window_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_window_rule_method_weekday" ON "window_rule" ("fulfillment_method", "weekday") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "blocked_date" cascade;`);

    this.addSql(`drop table if exists "booking" cascade;`);

    this.addSql(`drop table if exists "fulfillment_schedule" cascade;`);

    this.addSql(`drop table if exists "scheduling_settings" cascade;`);

    this.addSql(`drop table if exists "window_rule" cascade;`);
  }

}
