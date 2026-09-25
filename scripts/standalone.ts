import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import type { Plugin } from 'vite';

/** Preserve the downloadable, offline HTML and its exact script hash policy. */
export function standalone(): Plugin {
  let directory = '';
  return {
    name: 'atom66-standalone',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      directory = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      const file = resolve(directory, 'index.html');
      let html = await readFile(file, 'utf8');
      const hashes: string[] = [];
      const inlineScripts: string[] = [];
      const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)];
      const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
      if (scripts.length !== 1) throw new Error('Expected exactly one application bundle');
      for (const match of scripts) {
        const source = await readFile(resolve(directory, match[1].replace(/^\.?\//, '')), 'utf8');
        // Prevent script termination when source strings contain HTML markup.
        const script = source.replace(/<\/script/gi, '<\\/script');
        new Script(script, { filename: 'atom66.bundle.js' });
        hashes.push(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
        html = html.replace(match[0], '');
        inlineScripts.push(`<script>${script}</script>`);
      }
      for (const match of styles) {
        const css = await readFile(resolve(directory, match[1].replace(/^\.?\//, '')), 'utf8');
        html = html.replace(match[0], () => `<style>${css}</style>`);
      }
      if (!html.includes('</body>')) throw new Error('Missing document body');
      // Vite emits a deferred module in <head>; a classic inline IIFE must run after #root.
      html = html.replace('</body>', () => `${inlineScripts.join('\n')}\n</body>`);
      const csp = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`;
      if (!html.includes('<!-- BUILD:CSP -->')) throw new Error('CSP insertion marker is missing');
      html = html.replace(
        '<!-- BUILD:CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      );
      if (/<(?:script|link)\b[^>]*(?:src|href)=/.test(html.replace(/<script>[\s\S]*?<\/script>/g, '')))
        throw new Error('Unexpected external runtime asset');
      await writeFile(file, html);
      await writeFile(
        resolve(directory, '_headers'),
        '/*\n  Permissions-Policy: hid=(self)\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n',
      );
      await rm(resolve(directory, 'assets'), { recursive: true, force: true });
    },
  };
}
