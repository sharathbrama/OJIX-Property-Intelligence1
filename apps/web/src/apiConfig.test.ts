import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiConfig } from './apiConfig.js';

test('local builds may use the same-origin development proxy', () => {
  assert.deepEqual(resolveApiConfig(undefined, false), { baseUrl: '', error: '' });
  assert.deepEqual(resolveApiConfig('http://127.0.0.1:4001/', false), { baseUrl: 'http://127.0.0.1:4001', error: '' });
});

test('production requires a remote HTTPS API and rejects localhost', () => {
  assert.match(resolveApiConfig(undefined, true).error, /not configured/);
  assert.match(resolveApiConfig('http://api.example.test', true).error, /HTTPS/);
  assert.match(resolveApiConfig('https://localhost:4001', true).error, /localhost/);
  assert.match(resolveApiConfig('https://127.0.0.1:4001', true).error, /localhost/);
  assert.match(resolveApiConfig('https://api.example.test/v1', true).error, /origin/);
  assert.deepEqual(resolveApiConfig('https://api.example.test/', true), { baseUrl: 'https://api.example.test', error: '' });
});
