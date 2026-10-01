// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { atom68 } from '../src/devices/atom68/model';
import { importWindowsProfile } from '../src/devices/legacy';
import { Profile } from '../src/protocol';
import { atom68Fixture, atom68WindowsProfile } from './atom68-fixture';
import { FakeDevice, FakeHID } from './helpers';
import { openDeviceEditor } from './page-helpers';
import { acceptRead, application, memoryBackups, profileFile } from './store-helpers';

afterEach(cleanup);

test('official ATOM68 .pro roots retain all six groups, RGB positions and the original file', () => {
  for (const root of atom68.legacyRoots!) {
    const xml = atom68WindowsProfile(root);
    const profile = importWindowsProfile(xml);
    expect(profile.model).toBe(atom68);
    expect(profile.records).toHaveLength(408);
    expect(profile.records[407][0].slice(2, 4)).toEqual(new Uint8Array([6, 68]));
    expect(profile.definition(407).keys).toEqual([43]);
    expect(profile.lights?.slice(-3)).toEqual(new Uint8Array([67, 20, 30]));
    expect(Profile.fromJSON(profile.toJSON()).legacyXML).toBe(xml);
    profile.validateForWriting();
  }
  const xml = atom68WindowsProfile();
  for (const broken of [
    xml.replace('ID="68" Level="5"', 'ID="67" Level="5"'),
    xml.replace('ID="68" Level="5"', 'ID="69" Level="5"'),
    xml.replace('ID="68" Level="5"', 'ID="68" Level="6"'),
    xml.replace(/<KEY ID="68" Level="5"[^/]+\/>/, ''),
    xml.replaceAll('68EC(S)', '68pro(S)'),
  ]) expect(() => importWindowsProfile(broken)).toThrow();
  expect(() => importWindowsProfile(xml, undefined, {}, DOMParser, [])).toThrow();
});

test('ATOM68 cards, three editable layers and write warnings use the production model', async () => {
  const device = new FakeDevice(atom68Fixture(6, true));
  const { store, actions } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(store.getState().dialog).toBeNull();
  const card = within(screen.getByRole('article', { name: 'ATOM68 fixture' }));
  expect(card.getByRole('img', { name: 'NIZ ATOM68 静电容键盘官方产品图' })).toBeVisible();
  expect(card.getByText('68 键 · 3 个编辑层')).toBeVisible();
  expect(card.queryByRole('button', { name: '校准按键' })).not.toBeInTheDocument();
  await act(() => acceptRead(store));
  await openDeviceEditor();
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(204);
  expect(screen.getByText('6 组记录完整保留 · 编辑前 3 组')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /普通层，第 68 键/ }));
  await act(() => actions.assignKey(44));
  expect(store.getState().changes).toEqual([67]);
  fireEvent.click(screen.getByRole('button', { name: '核对并写入' }));
  const confirm = within(screen.getByRole('alertdialog'));
  expect(confirm.getByText('实机写入尚未验证。', { exact: false })).toBeVisible();
  expect(confirm.getByRole('button', { name: '取消' })).toHaveFocus();
  const before = device.sent.length;
  await act(() => actions.confirm(false));
  expect(device.sent).toHaveLength(before);
});

test('ATOM68 offline .pro import, JSON export and backup restore retain model identity', async () => {
  const backups = memoryBackups();
  const { store, actions, download } = application(null, backups);
  render(<App store={store} />);
  await act(() => actions.start());
  const text = atom68WindowsProfile('68EC(XRGB)');
  await act(() => actions.importFile({ name: 'atom68.pro', size: text.length, text: async () => text }));
  expect(store.getState().model).toBe(atom68);
  expect(store.getState().profile?.records).toHaveLength(408);
  expect(store.getState().canWrite).toBe(false);
  actions.exportProfile();
  expect(download).toHaveBeenCalledWith('配置', expect.objectContaining({ format: 'niz-web', model: 'atom68', legacyXML: text }));
  const profile = atom68Fixture();
  const id = await backups.save(profile);
  await act(() => actions.importFile(profileFile(profile)));
  await act(() => actions.importBackup(id));
  expect(store.getState().profile?.toJSON()).toEqual(profile.toJSON());
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(204);
});
