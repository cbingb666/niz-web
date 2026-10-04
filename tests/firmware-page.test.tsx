// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { stockFirmware } from '../src/firmware';
import { translate } from '../src/i18n/core';
import { FakeHID } from './helpers';
import { acceptRead, application } from './store-helpers';
import { firmwareDevice, syntheticFirmwareFile } from './firmware-helpers';
import { promiseGate } from './calibration-helpers';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function setup(locale: 'en' | 'zh-CN' = 'en', read = false) {
  vi.stubGlobal('crypto', webcrypto);
  const device = firmwareDevice(), hid = new FakeHID([device]);
  const app = application(hid, undefined, { locale }, { firmwarePacketDelay: 0, firmwareRestartTimeout: 10 });
  const view = render(<App store={app.store} usbAvailable />);
  await act(() => app.actions.start());
  if (read) await act(() => acceptRead(app.store));
  return { ...app, ...view, device, hid };
}

async function chooseSyntheticFile() {
  const digest = Uint8Array.from(stockFirmware.sha256.match(/../g)!, byte => parseInt(byte, 16));
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(digest.buffer);
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/\.bin/), { target: { files: [syntheticFirmwareFile()] } });
    await vi.waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(/Package verified|升级包已校验/));
  });
}

test.each(['en', 'zh-CN'] as const)('%s preview allows starting without a prior read and cancels without I/O', async locale => {
  const { device, store } = await setup(locale);
  const before = device.sent.length;
  const entry = screen.getByRole('button', { name: translate(locale, 'firmware.entry') });
  fireEvent.click(entry);
  const dialog = screen.getByRole('alertdialog', { name: translate(locale, 'firmware.title') });
  const cancel = within(dialog).getByRole('button', { name: translate(locale, 'common.cancel') });
  expect(cancel).toHaveFocus();
  expect(dialog).toHaveTextContent(translate(locale, 'firmware.scope'));
  expect(within(dialog).getByRole('img')).toBeVisible();
  await chooseSyntheticFile();
  expect(within(dialog).getByRole('button', { name: translate(locale, 'confirm.writeAction') })).toBeEnabled();
  fireEvent.click(cancel);
  expect(store.getState().firmware).toBeNull();
  expect(device.sent).toHaveLength(before);
  await vi.waitFor(() => expect(entry).toHaveFocus());
});

test('unapplied input blocks flashing and survives opening and cancelling the tool', async () => {
  const { actions, store } = await setup('en', true);
  act(() => actions.updateForm({ sequence: 'A' }));
  const drafts = store.getState().drafts;
  fireEvent.click(screen.getByRole('button', { name: 'Flash firmware (experimental)' }));
  await chooseSyntheticFile();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('apply or discard');
  expect(screen.getByRole('button', { name: 'Start writing' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(store.getState().drafts).toEqual(drafts);
});

test('invalid package errors stay visible and can be corrected without leaving the dialog', async () => {
  const { store, device } = await setup('en', true);
  fireEvent.click(screen.getByRole('button', { name: 'Flash firmware (experimental)' }));
  await act(() => store.getState().actions.selectFirmwareFile(syntheticFirmwareFile()));
  expect(screen.getByRole('alert')).toHaveTextContent('SHA-256');
  expect(screen.getByRole('button', { name: 'Start writing' })).toBeDisabled();
  await chooseSyntheticFile();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start writing' })).toBeEnabled();
  expect(device.flashCount).toBe(0);
});

test('active flashing locks the background, prevents dismissal, and retains a recoverable failure', async () => {
  const { store, actions, device, container } = await setup();
  const gate = promiseGate();
  device.firmwareSend = () => gate.promise;
  fireEvent.click(screen.getByRole('button', { name: 'Flash firmware (experimental)' }));
  await chooseSyntheticFile();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start writing' }));
    await vi.waitFor(() => expect(device.flashCount).toBe(1));
  });
  expect(container.querySelector('.app-shell')).toHaveAttribute('inert');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  fireEvent.pointerDown(document.body);
  await actions.navigate('connect');
  expect(store.getState().dialog?.kind).toBe('firmware');
  expect(store.getState().page).toBe('devices');
  const leaving = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  await act(async () => { gate.reject(new Error('synthetic failure')); await vi.waitFor(() => expect(store.getState().hardwareOperation).toBeNull()); });
  expect(container.querySelector('.app-shell')).not.toHaveAttribute('inert');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Do not automatically retry');
  expect(screen.queryByRole('button', { name: 'Start writing' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review flash result' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Flashing did not complete');
});

test('transfer completion is not displayed as success, and late disconnect enables explicit verification', async () => {
  const { store, hid, device, actions, container } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Flash firmware (experimental)' }));
  await chooseSyntheticFile();
  await act(() => actions.startFirmware());
  expect(store.getState().firmware?.state.phase).toBe('unconfirmed');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Select keyboard and check version' })).toBeDisabled();
  expect(container.querySelector('.app-shell')).not.toHaveAttribute('inert');
  await act(async () => { hid.disconnect(device); await Promise.resolve(); });
  expect(screen.getByRole('button', { name: 'Select keyboard and check version' })).toBeEnabled();
  expect(store.getState().firmware?.state.phase).toBe('awaiting-reconnect');
  hid.selection = [device];
  await act(() => actions.verifyFirmware());
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Selected device version checked');
  expect(screen.getByRole('alertdialog')).toHaveTextContent('does not prove that every firmware byte matches');
});

test.each(['en', 'zh-CN'] as const)('%s starts automatic configuration reading only after confirmation and preserves a read error', async locale => {
  const { store, actions, device, backups, container } = await setup(locale);
  device.omitResponses.add(0xf2);
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'firmware.entry') }));
  await chooseSyntheticFile();
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
  await act(() => actions.startFirmware());
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9, 0xf9, 0xf2]);
  expect(device.flashCount).toBe(0);
  expect(backups.save).not.toHaveBeenCalled();
  expect(store.getState().firmware?.state).toMatchObject({ phase: 'failed', attempted: false });
  expect(store.getState().profile).toBeNull();
  expect(store.getState().session.connected).toBe(true);
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByRole('alertdialog')).toHaveTextContent(translate(locale, 'firmware.noWrite'));
  expect(container.querySelector('.app-shell')).not.toHaveAttribute('inert');
});
