import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { packageManager } from '../package.json';

const guard = fileURLToPath(new URL('../scripts/require-pnpm.mjs', import.meta.url));

it('accepts the pinned pnpm version', () => {
  const result = spawnSync(process.execPath, [guard], {
    env: { ...process.env, npm_config_user_agent: `${packageManager.replace('@', '/')} npm/? node/v24.12.0` },
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

it('accepts a pnpm install hook without a user agent', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, npm_execpath: '/tools/pnpm/bin/pnpm.mjs' };
  delete env.npm_config_user_agent;
  const result = spawnSync(process.execPath, [guard], { env, encoding: 'utf8' });
  expect(result.status).toBe(0);
});

it('rejects an npm install hook without a user agent', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, npm_execpath: '/tools/npm/bin/npm-cli.js' };
  delete env.npm_config_user_agent;
  const result = spawnSync(process.execPath, [guard], { env, encoding: 'utf8' });
  expect(result.status).toBe(1);
});

it.each(['npm/11.6.2', 'yarn/1.22.22', 'bun/1.3.0', 'pnpm/10.0.0', '', 'pnpm/11.0.10'])(
  'rejects an unsupported package manager or version: %s', (agent) => {
    const result = spawnSync(process.execPath, [guard], {
      env: { ...process.env, npm_config_user_agent: agent },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`This project requires ${packageManager}`);
    expect(result.stderr).toContain('pnpm install --frozen-lockfile');
  },
);
