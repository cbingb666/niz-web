import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { FakeHID } from './helpers';
import { CalibrationDevice, calibrationTraffic, rgbCalibrationDevice } from './calibration-helpers';

test('production is one offline HTML with hash CSP and HID permissions', async () => {
  const outDir = resolve(tmpdir(), `niz-web-build-${process.pid}`);
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
      url: 'https://niz.example/niz-web/',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: console,
      beforeParse(window) {
        Object.defineProperty(window.navigator, 'languages', { value: ['zh-CN'] });
        window.localStorage.setItem('atom66.locale', 'en');
      },
    });
    try {
      await vi.waitFor(() => expect(dom.window.document.querySelector('.device-page')).not.toBeNull());
      await vi.waitFor(() => expect(dom.window.document.documentElement.lang).toBe('en'));
      expect(dom.window.document.title).toBe('NIZ — Keyboard configurator');
      expect(
        dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content'),
      ).toContain('Configure supported NIZ');
      const document = dom.window.document;
      expect(document.querySelectorAll('link[href]')).toHaveLength(1);
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      const faviconUrl = favicon?.getAttribute('href') ?? '';
      expect(faviconUrl).toMatch(/^data:image\/(?:x-icon|vnd\.microsoft\.icon);base64,/);
      expect(Buffer.from(faviconUrl.split(',')[1], 'base64')).toEqual(
        await readFile(resolve('src/assets/favicon.ico')),
      );
      expect(document.getElementById('page-title')?.textContent).toBe('Connect your keyboard');
      expect(document.querySelector('.device-count')).toBeNull();
      expect(document.querySelector('.devices-empty .cable-demo svg')).not.toBeNull();
      expect(document.querySelector('.devices-empty img')).toBeNull();
      Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Connect a device')!.click();
      await vi.waitFor(() => expect(document.querySelector('.connection-guide-page')).not.toBeNull());
      expect(document.getElementById('page-title')?.textContent).toBe('Check the model underneath');
      expect(document.querySelector('.support-preview svg')).not.toBeNull();
      expect(document.querySelector('.support-preview img')).toBeNull();
      const supportNext = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Model confirmed — next')!;
      expect(supportNext.disabled).toBe(true);
      document.querySelector<HTMLButtonElement>('button[role="checkbox"]')!.click();
      await vi.waitFor(() => expect(supportNext.disabled).toBe(false));
      supportNext.click();
      await vi.waitFor(() => expect(document.querySelector('.cable-demo svg')).not.toBeNull());
      Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Offline demo')!.click();
      await vi.waitFor(() => expect(document.querySelectorAll('.key')).toHaveLength(66));
      expect(errors).toEqual([]);
    } finally {
      dom.window.close();
    }
    // The real production artifact offers calibration by default, while opening
    // and cancelling its confirmation sends no calibration commands. Synthetic HID only.
    const devices = [new CalibrationDevice(), rgbCalibrationDevice()];
    const connected = new JSDOM(html, {
      url: 'https://niz.example/niz-web/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console,
      beforeParse(window) {
        Object.defineProperty(window, 'isSecureContext', { value: true });
        Object.defineProperty(window, 'TextDecoder', { value: TextDecoder });
        Object.defineProperty(window.navigator, 'hid', { value: new FakeHID(devices) });
        window.localStorage.setItem('atom66.locale', 'en');
      },
    });
    try {
      await vi.waitFor(() => expect(connected.window.document.querySelectorAll('.device-card')).toHaveLength(devices.length));
      const document = connected.window.document;
      const cards = document.querySelectorAll('.device-card');
      for (const [index, device] of devices.entries()) {
        const card = cards[index];
        expect(card.textContent).toContain(device.profile.version);
        const calibrate = card.querySelector<HTMLButtonElement>('.device-calibration');
        expect(calibrate).not.toBeNull();
        expect(calibrate!.disabled).toBe(false);
        expect(calibrationTraffic(device)).toEqual([]);
        calibrate!.click();
        await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
        const dialog = document.querySelector('[role="alertdialog"]')!;
        expect(dialog.textContent).toContain('Calibration on real hardware has not yet been verified');
        const cancel = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === 'Cancel')!;
        expect(document.activeElement).toBe(cancel);
        cancel.click();
        await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull());
        expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
      }
      expect(errors).toEqual([]);
    } finally { connected.window.close(); }
    const script = scripts[0][1];
    expect(script).toMatch(/data:image\/webp;base64,/);
    expect(() => new Script(script)).not.toThrow();
    const digest = createHash('sha256').update(script).digest('base64');
    expect(html).toContain(`script-src 'sha256-${digest}'`);
    expect(html).toContain("connect-src 'none'");
    expect(html.replace(/<script>[\s\S]*?<\/script>/g, '')).not.toMatch(
      /<script[^>]+src=|<!-- BUILD:/,
    );
    expect(script).not.toMatch(/\beval\s*\(|\bnew Function\s*\(/);
    expect(await readdir(outDir)).toEqual(expect.arrayContaining(['index.html', '_headers']));
    expect((await readdir(outDir)).sort()).toEqual(['_headers', 'index.html']);
    expect(await readFile(resolve(outDir, '_headers'), 'utf8')).toContain('Permissions-Policy: hid=(self)');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}, 30_000);
