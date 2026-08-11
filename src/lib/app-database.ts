import mysql from "mysql2/promise";
import { appDbConfig } from "../config/database.config";

export type TxQuery = <T = any>(sql: string, values?: any[]) => Promise<T>;

/** Connection pool for our own app database (snapshots, employee, ...). */
export class AppDatabase {
  private readonly pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(appDbConfig);
  }

  async query<T = any>(sql: string, values?: any[]): Promise<T> {
    const [results] = await this.pool.query(sql, values);
    return results as T;
  }

  /**
   * Runs `fn` inside a single transaction, committing on success and
   * rolling back on failure.
   */
  async withTransaction<T>(fn: (txQuery: TxQuery) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const txQuery: TxQuery = async (sql, values) => {
        const [results] = await connection.query(sql, values);
        return results as any;
      };

      const result = await fn(txQuery);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
