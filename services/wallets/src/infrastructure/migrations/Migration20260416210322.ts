import { Migration } from '@mikro-orm/migrations';

export class Migration20260416210322 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter type "wallet_outbox_status" add value if not exists 'UNROUTABLE' after 'PROCESSING';`);
  }

}
