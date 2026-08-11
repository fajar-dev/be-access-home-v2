import mysql from "mysql2/promise";
import { billingDbConfig } from "../config/database.config";

/**
 * Connection pool for the billing/source system (NIS) that new-customer
 * and old-customer jobs read invoices from — separate from AppDatabase.
 */
export class BillingDatabase {
  private readonly pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(billingDbConfig);
  }

  async query<T = any>(sql: string, values?: any[]): Promise<T> {
    const [results] = await this.pool.query(sql, values);
    return results as T;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
