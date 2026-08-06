import mysql from "mysql";

const pool = mysql.createPool({
  host: process.env.NIS_DB_HOST,
  port: process.env.NIS_DB_PORT ? Number(process.env.NIS_DB_PORT) : 3306,
  user: process.env.NIS_DB_USER,
  password: process.env.NIS_DB_PASSWORD,
  database: process.env.NIS_DB_NAME,
});

export function nisQuery<T = any>(sql: string, values?: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) return reject(error);
      resolve(results as T);
    });
  });
}

export function endNisPool(): Promise<void> {
  return new Promise((resolve, reject) => {
    pool.end((error) => (error ? reject(error) : resolve()));
  });
}
