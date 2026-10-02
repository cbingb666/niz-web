// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { importWindowsProfile } from '../src/devices/legacy';
import { Profile } from '../src/protocol';
import { translate } from '../src/i18n/core';
import { microFixture, microModels, microWindowsProfile } from './micro-fixture';
import { FakeDevice, FakeHID } from './helpers';
import { openDeviceEditor } from './page-helpers';
import { acceptRead, application, memoryBackups, profileFile } from './store-helpers';

afterEach(cleanup);

test.each(microModels)('$name .pro imports validate roots, key addresses, three layers and RGB positions', model => {
  for (const root of model.legacyRoots!) {
    const xml = microWindowsProfile(model, root);
    const profile = importWindowsProfile(xml);
    expect(profile.model).toBe(model);
    expect(profile.records).toHaveLength(model.keyCount * 3);
    expect(profile.records.at(-1)![0].slice(2, 4)).toEqual(new Uint8Array([3, model.keyCount]));
    expect(profile.lights?.slice(-3)).toEqual(new Uint8Array([model.keyCount - 1, 20, 30]));
    expect(Profile.fromJSON(profile.toJSON()).legacyXML).toBe(xml);
    profile.validateForWriting();
  }
  const xml = microWindowsProfile(model), last = `ID="${model.keyCount}" Level="2"`;
  for (const broken of [
    xml.replace(last, `ID="${model.keyCount - 1}" Level="2"`),
    xml.replace(last, `ID="${model.keyCount + 1}" Level="2"`),
    xml.replace(last, `ID="${model.keyCount}" Level="3"`),
    xml.replace(/<KEY ID="1" Level="0"[^/]+\/>/, ''),
    xml.replaceAll(model.legacyRoots![0], '82pro(S)'),
  ]) expect(() => importWindowsProfile(broken)).toThrow();
});

test.each(microModels.flatMap(model => (['zh-CN', 'en'] as const).map(locale => ({ model, locale }))))('$locale demo selection opens $model.name and navigates its function row without USB access', async ({ model, locale }) => {
  const hid = new FakeHID();
  const { store, actions, download } = application(hid, undefined, { locale });
  render(<App store={store} />);
  await act(() => actions.start());
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: translate(locale, 'keyboard.demo') })); });
  const image = screen.getByRole('img', { name: translate(locale, model.id === 'micro82' ? 'devices.micro82Illustration' : 'devices.micro84Illustration') });
  expect(image).toBeVisible();
  expect(image.tagName).toBe('IMG');
  expect(image).toHaveAttribute('src', expect.stringContaining(`${model.id}-product-retouched.webp`));
  fireEvent.click(screen.getByRole('radio', { name: model.name }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: translate(locale, 'demo.start') })); });
  expect(store.getState().model).toBe(model);
  expect(store.getState().canWrite).toBe(false);
  expect(screen.getAllByRole('button', { name: /(?:第 \d+ 键|key \d+,)/ })).toHaveLength(model.keyCount * 3);
  const keyboard = screen.getByLabelText(translate(locale, 'keyboard.physical', { model: model.name }));
  expect(keyboard.querySelectorAll('.key-row')).toHaveLength(6);
  const topRow = keyboard.querySelector('.key-row') as HTMLElement;
  expect(topRow.style.getPropertyValue('--row-units')).toBe('16');
  const f5 = screen.getByRole('button', { name: locale === 'en' ? /Normal, key 6,/ : /普通层，第 6 键/ });
  fireEvent.click(f5);
  fireEvent.keyDown(f5, { key: 'ArrowDown' });
  // F5 sits above the 6 key when gaps between F-key groups are retained.
  expect(store.getState().key).toBe(20);
  expect(screen.getByRole('button', { name: locale === 'en' ? /Normal, key 21,/ : /普通层，第 21 键/ })).toHaveFocus();
  actions.exportProfile();
  expect(download).toHaveBeenCalledWith(translate(locale, 'download.profile'), expect.objectContaining({ format: 'niz-web', model: model.id }));
  expect(hid.requestCount).toBe(0);
});

test.each(microModels)('$name device cards require explicit reading and warn before an unverified write', async model => {
  const device = new FakeDevice(microFixture(model, true));
  const { store, actions } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(store.getState().dialog).toBeNull();
  const card = within(screen.getByRole('article', { name: `${model.name} fixture` }));
  expect(card.getByRole('img', { name: translate('zh-CN', model.id === 'micro82' ? 'devices.micro82Illustration' : 'devices.micro84Illustration') })).toBeVisible();
  expect(card.getByText(`${model.keyCount} 键 · 3 个编辑层`)).toBeVisible();
  expect(card.queryByRole('button', { name: '校准按键' })).not.toBeInTheDocument();
  await act(() => acceptRead(store));
  await openDeviceEditor();
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(model.keyCount * 3);
  await act(() => actions.assignKey(44));
  fireEvent.click(screen.getByRole('button', { name: '核对并写入' }));
  const confirm = within(screen.getByRole('alertdialog'));
  expect(confirm.getByText('实机写入尚未验证。', { exact: false })).toBeVisible();
  expect(confirm.getByRole('button', { name: '取消' })).toHaveFocus();
  const before = device.sent.length;
  await act(() => actions.confirm(false));
  expect(device.sent).toHaveLength(before);
});

test.each(microModels)('$name .pro import, JSON export and local backup restore keep model ownership', async model => {
  const backups = memoryBackups();
  const { store, actions, download } = application(null, backups);
  render(<App store={store} />);
  await act(() => actions.start());
  const text = microWindowsProfile(model);
  await act(() => actions.importFile({ name: `${model.id}.pro`, size: text.length, text: async () => text }));
  expect(store.getState().model).toBe(model);
  expect(store.getState().canWrite).toBe(false);
  actions.exportProfile();
  expect(download).toHaveBeenCalledWith('配置', expect.objectContaining({ format: 'niz-web', model: model.id, legacyXML: text }));
  const profile = microFixture(model);
  const id = await backups.save(profile);
  await act(() => actions.importFile(profileFile(profile)));
  await act(() => actions.importBackup(id));
  expect(store.getState().profile?.toJSON()).toEqual(profile.toJSON());
});
