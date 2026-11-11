import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

const databaseUrl = process.env.TEST_DATABASE_URL || '';
const mysqlPool = mysql.createPool({ uri: databaseUrl || 'mysql://missing:test@127.0.0.1:1/missing_test_database', connectionLimit: 4 });

export const pool = {
  async query(sql: string, params: unknown[] = []) {
    if (!databaseUrl) throw new Error('Set TEST_DATABASE_URL to a dedicated disposable test database before running database-backed API tests.');
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
