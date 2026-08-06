import mysql from "mysql";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export function query<T = any>(sql: string, values?: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) return reject(error);
      resolve(results as T);
    });
  });
}

export function endPool(): Promise<void> {
  return new Promise((resolve, reject) => {
    pool.end((error) => (error ? reject(error) : resolve()));
  });
}

type TxQuery = <T = any>(sql: string, values?: any[]) => Promise<T>;

export function withTransaction<T>(fn: (txQuery: TxQuery) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pool.getConnection((connErr, connection) => {
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
