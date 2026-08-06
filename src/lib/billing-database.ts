import mysql from "mysql";
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

  query<T = any>(sql: string, values?: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, values, (error, results) => {
        if (error) return reject(error);
        resolve(results as T);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pool.end((error) => (error ? reject(error) : resolve()));
    });
  }
}
