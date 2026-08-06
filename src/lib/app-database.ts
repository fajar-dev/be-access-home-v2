import mysql from "mysql";
import { appDbConfig } from "../config/database.config";

export type TxQuery = <T = any>(sql: string, values?: any[]) => Promise<T>;

/** Connection pool for our own app database (snapshots, employee, ...). */
export class AppDatabase {
  private readonly pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(appDbConfig);
  }

  query<T = any>(sql: string, values?: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, values, (error, results) => {
        if (error) return reject(error);
        resolve(results as T);
      });
    });
  }

  /**
   * Runs `fn` inside a single transaction, committing on success and
   * rolling back on failure.
   */
  withTransaction<T>(fn: (txQuery: TxQuery) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((connErr, connection) => {
        if (connErr) return reject(connErr);

        const fail = (error: unknown) => {
          connection.rollback(() => {
            connection.release();
            reject(error);
          });
        };

        connection.beginTransaction((beginErr) => {
          if (beginErr) {
            connection.release();
            return reject(beginErr);
          }

          const txQuery: TxQuery = (sql, values) =>
            new Promise((res, rej) => {
              connection.query(sql, values, (error, results) => {
                if (error) return rej(error);
                res(results);
              });
            });

          fn(txQuery)
            .then((result) => {
              connection.commit((commitErr) => {
                if (commitErr) return fail(commitErr);
                connection.release();
                resolve(result);
              });
            })
            .catch(fail);
        });
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pool.end((error) => (error ? reject(error) : resolve()));
    });
  }
}
