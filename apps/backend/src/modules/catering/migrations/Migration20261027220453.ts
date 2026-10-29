import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261027220453 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "delivery_zone_code" drop constraint if exists "delivery_zone_code_code_unique";`);
    this.addSql(`create table if not exists "delivery_zone" ("id" text not null, "name" text not null, "price" numeric not null, "min_order_value" numeric null, "raw_price" jsonb not null, "raw_min_order_value" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_zone_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_deleted_at" ON "delivery_zone" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "delivery_zone_code" ("id" text not null, "code" text not null, "zone_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_zone_code_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_code_zone_id" ON "delivery_zone_code" ("zone_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_code_deleted_at" ON "delivery_zone_code" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_delivery_zone_code_code_unique" ON "delivery_zone_code" ("code") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "delivery_zone_code" add constraint "delivery_zone_code_zone_id_foreign" foreign key ("zone_id") references "delivery_zone" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table if exists "blocked_date" drop constraint if exists "blocked_date_fulfillment_method_check";`);

    this.addSql(`alter table if exists "booking" drop constraint if exists "booking_fulfillment_method_check";`);

    this.addSql(`alter table if exists "fulfillment_schedule" drop constraint if exists "fulfillment_schedule_fulfillment_method_check";`);

    this.addSql(`alter table if exists "window_rule" drop constraint if exists "window_rule_fulfillment_method_check";`);

    this.addSql(`alter table if exists "blocked_date" add constraint "blocked_date_fulfillment_method_check" check("fulfillment_method" in ('pickup', 'delivery'));`);

    this.addSql(`alter table if exists "booking" add column if not exists "delivery_postal_code" text null, add column if not exists "delivery_zone_id" text null, add column if not exists "delivery_zone_name" text null, add column if not exists "delivery_cost" numeric null, add column if not exists "raw_delivery_cost" jsonb null;`);
    this.addSql(`alter table if exists "booking" add constraint "booking_fulfillment_method_check" check("fulfillment_method" in ('pickup', 'delivery'));`);

    this.addSql(`alter table if exists "fulfillment_schedule" add column if not exists "max_orders_per_window" integer null;`);
    this.addSql(`alter table if exists "fulfillment_schedule" add constraint "fulfillment_schedule_fulfillment_method_check" check("fulfillment_method" in ('pickup', 'delivery'));`);

    this.addSql(`alter table if exists "window_rule" add constraint "window_rule_fulfillment_method_check" check("fulfillment_method" in ('pickup', 'delivery'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "delivery_zone_code" drop constraint if exists "delivery_zone_code_zone_id_foreign";`);

    this.addSql(`drop table if exists "delivery_zone" cascade;`);

    this.addSql(`drop table if exists "delivery_zone_code" cascade;`);

    this.addSql(`alter table if exists "blocked_date" drop constraint if exists "blocked_date_fulfillment_method_check";`);

    this.addSql(`alter table if exists "booking" drop constraint if exists "booking_fulfillment_method_check";`);

    this.addSql(`alter table if exists "fulfillment_schedule" drop constraint if exists "fulfillment_schedule_fulfillment_method_check";`);

    this.addSql(`alter table if exists "window_rule" drop constraint if exists "window_rule_fulfillment_method_check";`);

    this.addSql(`alter table if exists "blocked_date" add constraint "blocked_date_fulfillment_method_check" check("fulfillment_method" in ('pickup'));`);

    this.addSql(`alter table if exists "booking" drop column if exists "delivery_postal_code", drop column if exists "delivery_zone_id", drop column if exists "delivery_zone_name", drop column if exists "delivery_cost", drop column if exists "raw_delivery_cost";`);

    this.addSql(`alter table if exists "booking" add constraint "booking_fulfillment_method_check" check("fulfillment_method" in ('pickup'));`);

    this.addSql(`alter table if exists "fulfillment_schedule" drop column if exists "max_orders_per_window";`);

    this.addSql(`alter table if exists "fulfillment_schedule" add constraint "fulfillment_schedule_fulfillment_method_check" check("fulfillment_method" in ('pickup'));`);

    this.addSql(`alter table if exists "window_rule" add constraint "window_rule_fulfillment_method_check" check("fulfillment_method" in ('pickup'));`);
  }

}
