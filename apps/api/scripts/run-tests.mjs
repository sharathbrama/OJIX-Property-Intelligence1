import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required. Use a dedicated disposable local database; the test runner never falls back to DATABASE_URL.');
}

const database = new URL(databaseUrl);
const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ''));
if (!['mysql:', 'mariadb:'].includes(database.protocol) || !['127.0.0.1', 'localhost', '::1'].includes(database.hostname)) {
  throw new Error('TEST_DATABASE_URL must point to a loopback-only MySQL/MariaDB test server.');
}
if (!/(?:^|[_-])(test|testing|sandbox|rehearsal)(?:$|[_-])/i.test(databaseName)) {
  throw new Error('TEST_DATABASE_URL database name must contain a test, sandbox, or rehearsal marker.');
}

const apiUrl = new URL(process.env.TEST_API_URL || 'http://127.0.0.1:4000');
if (apiUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(apiUrl.hostname)) {
  throw new Error('TEST_API_URL must be a loopback HTTP address; tests must not target a deployed service.');
}
const apiPort = Number(apiUrl.port || 80);
const baseUrl = apiUrl.origin;

try {
  await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(500) });
  throw new Error(`Refusing to run tests because ${baseUrl} is already serving. Stop it so the runner cannot touch an unknown database.`);
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Refusing to run tests')) throw error;
  if (error?.name !== 'TypeError' && error?.name !== 'AbortError' && error?.name !== 'TimeoutError') throw error;
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  TEST_API_SERVER: 'true',
  PORT: String(apiPort),
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  TEST_API_URL: baseUrl,
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join('/tmp', `ojix-test-uploads-${process.pid}`),
  DOCUMENT_STORAGE_PROVIDER: 'local',
};

const api = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: apiRoot,
  env,
  stdio: 'inherit',
});
let stopping = false;
const stopApi = async () => {
  if (stopping) return;
  stopping = true;
  if (api.exitCode !== null) return;
  api.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => api.once('exit', resolve)),
    new Promise(resolve => setTimeout(() => { api.kill('SIGKILL'); resolve(); }, 5000)),
  ]);
};
process.once('SIGINT', () => void stopApi().finally(() => process.exit(130)));
process.once('SIGTERM', () => void stopApi().finally(() => process.exit(143)));

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  let lastError = 'API has not responded yet.';
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`Test API exited during startup (${api.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/readyz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const body = await response.json();
        if (body.status === 'ready') return;
        lastError = 'API readiness response did not report ready.';
      } else lastError = `API readiness returned HTTP ${response.status}.`;
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Test API did not become ready within 30 seconds: ${lastError}`);
}

let exitCode = 1;
try {
  await waitUntilReady();
  const tests = readdirSync(path.join(apiRoot, 'test')).filter(file => file.endsWith('.test.ts')).sort().map(file => path.join('test', file));
  const testEnv = { ...env };
  delete testEnv.TEST_API_SERVER;
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...tests], {
    cwd: apiRoot,
    env: testEnv,
    stdio: 'inherit',
  });
  exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
} finally {
  await stopApi();
}
process.exitCode = Number(exitCode);
