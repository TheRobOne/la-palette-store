import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260928145224 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "catering_product_info" ("id" text not null, "min_quantity" integer not null default 1, "quantity_step" integer not null default 1, "pricing_unit" text check ("pricing_unit" in ('piece', 'portion', 'person')) not null, "ingredients" text not null, "allergens" jsonb not null default '[]', "dietary_tags" jsonb not null default '[]', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "catering_product_info_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_catering_product_info_deleted_at" ON "catering_product_info" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "catering_product_info" cascade;`);
  }

}
