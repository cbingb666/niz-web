import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const requiredAgent = packageManager.replace('@', '/');
const currentAgent = process.env.npm_config_user_agent?.split(' ')[0];

// pnpm 11 install hooks may omit the user agent. Its CLI validates devEngines.
const pnpmInstallHook = currentAgent === undefined
  && /^pnpm(?:\.(?:cjs|mjs|js|exe))?$/.test(basename(process.env.npm_execpath ?? ''));

if (currentAgent !== requiredAgent && !pnpmInstallHook) {
  console.error(`This project requires ${packageManager}. Run: pnpm install --frozen-lockfile`);
  process.exit(1);
}
