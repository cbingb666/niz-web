import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';

test('production is one offline HTML with hash CSP and HID permissions', async () => {
  const outDir = resolve(tmpdir(), `atom66-build-${process.pid}`);
  try {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const html = await readFile(resolve(outDir, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(html.indexOf('<script>')).toBeGreaterThan(html.indexOf('id="root"'));
    const errors: Error[] = [];
    const console = new VirtualConsole();
    console.on('jsdomError', (error) => errors.push(error));
    const dom = new JSDOM(html, {
      url: 'https://atom66.example/',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: console,
      beforeParse(window) {
        Object.defineProperty(window.navigator, 'languages', { value: ['zh-CN'] });
        window.localStorage.setItem('atom66.locale', 'en');
      },
    });
    try {
      await vi.waitFor(() => expect(dom.window.document.querySelectorAll('.key')).toHaveLength(66));
      await vi.waitFor(() => expect(dom.window.document.documentElement.lang).toBe('en'));
      expect(dom.window.document.title).toBe('NIZ — Keyboard configurator');
      expect(
        dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content'),
      ).toContain('Configure supported NIZ');
      expect(dom.window.document.getElementById('root')?.textContent).toContain('Connect keyboard');
      expect(errors).toEqual([]);
    } finally {
      dom.window.close();
    }
    const script = scripts[0][1];
    expect(() => new Script(script)).not.toThrow();
    const digest = createHash('sha256').update(script).digest('base64');
    expect(html).toContain(`script-src 'sha256-${digest}'`);
    expect(html).toContain("connect-src 'none'");
    expect(html.replace(/<script>[\s\S]*?<\/script>/g, '')).not.toMatch(
      /<script[^>]+src=|<link[^>]+href=|<!-- BUILD:/,
    );
    expect(script).not.toMatch(/\beval\s*\(|\bnew Function\s*\(/);
    expect(await readdir(outDir)).toEqual(expect.arrayContaining(['index.html', '_headers']));
    expect((await readdir(outDir)).sort()).toEqual(['_headers', 'index.html']);
    expect(await readFile(resolve(outDir, '_headers'), 'utf8')).toContain('Permissions-Policy: hid=(self)');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}, 30_000);
