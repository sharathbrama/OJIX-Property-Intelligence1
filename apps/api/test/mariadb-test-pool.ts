import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL || 'mysql://ojix:ojix_local_only@127.0.0.1:3306/ojix_property_mysql';
const mysqlPool = mysql.createPool({ uri: databaseUrl, connectionLimit: 4 });

export const pool = {
  async query(sql: string, params: unknown[] = []) {
    let returnedId: string | undefined;
    if (/\/\*RETURN_ID\*\/\s*;?\s*$/i.test(sql)) {
      returnedId = crypto.randomUUID();
      sql = sql
        .replace(/\/\*RETURN_ID\*\/\s*;?\s*$/i, '')
        .replace(/(INSERT\s+INTO\s+documents\s*\()/i, '$1id, ')
        .replace(/(\)\s*VALUES\s*\()/i, '$1?, ');
      params = [returnedId, ...params];
    }
    const [result] = await mysqlPool.query(sql, params);
    if (returnedId) return { rows: [{ id: returnedId }], rowCount: 1 };
    if (Array.isArray(result)) return { rows: result as any[], rowCount: result.length };
    return { rows: [], rowCount: (result as any).affectedRows ?? 0 };
  },
  async end() {
    await mysqlPool.end();
  },
};
