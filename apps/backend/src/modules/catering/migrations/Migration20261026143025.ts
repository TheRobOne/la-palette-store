import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261026143025 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "blocked_date" add column if not exists "period_id" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blocked_date_period_id" ON "blocked_date" ("period_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_blocked_date_period_id";`);
    this.addSql(`alter table if exists "blocked_date" drop column if exists "period_id";`);
  }

}
