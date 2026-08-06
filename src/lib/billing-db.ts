import mysql from "mysql";
import { billingDbConfig } from "../config/database.config";

const pool = mysql.createPool(billingDbConfig);

export function billingQuery<T = any>(sql: string, values?: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) return reject(error);
      resolve(results as T);
    });
  });
}

export function endBillingPool(): Promise<void> {
  return new Promise((resolve, reject) => {
    pool.end((error) => (error ? reject(error) : resolve()));
  });
}
