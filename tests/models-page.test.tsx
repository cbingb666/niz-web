// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { chooseMappingType, openDeviceEditor } from './page-helpers';
import { defaultModel } from '../src/devices';
import type { ModelTool } from '../src/model-tools';
import { FakeDevice, FakeHID } from './helpers';
import { modelFixture, test68 } from './model-fixtures';
import { application, memoryBackups, profileFile, acceptRead } from './store-helpers';

afterEach(cleanup);

test('connection renders the loaded geometry, layers and counters and edits the correct record', async () => {
  const models = [defaultModel, test68];
  const device = new FakeDevice(modelFixture(test68, 4));
  const { store, actions } = application(new FakeHID([device]), memoryBackups(models), {}, { models });
  device.profile.setDefinition(0, { type: 0, keys: [156] });
  const tools: ModelTool[] = [];
  render(<App store={store} usbAvailable />);
  await act(async () => {
    await actions.start({ registerTool: (tool) => tools.push(tool) });
    await acceptRead(store);
  });
  await openDeviceEditor();
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(136);
  expect(screen.queryByRole('group', { name: '编辑层' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: '编辑层' })).not.toBeInTheDocument();
  expect(screen.getByText('4 组记录完整保留 · 编辑前 2 组')).toBeInTheDocument();
  expect(tools.at(-2)?.inputSchema).toMatchObject({ properties: { layer: { maximum: 1 } } });
  fireEvent.click(screen.getByRole('button', { name: /Primary，第 68 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: /Function，第 68 键，/ }));
  expect(store.getState().key).toBe(67);
  expect(store.getState().layer).toBe(1);
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'C' } });
  fireEvent.click(screen.getByRole('button', { name: '应用这次编辑' }));
  expect(store.getState().profile?.definition(135).keys).toEqual([58]);
  expect(store.getState().changes).toEqual([67, 135]);
  expect(store.getState().profile?.definition(67).keys).toEqual([58]);
  const last = screen.getByRole('button', { name: /Function，第 68 键，/ });
  fireEvent.keyDown(last, { key: 'ArrowUp' });
  expect(screen.getByRole('button', { name: /Function，第 35 键，/ })).toHaveFocus();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  expect(screen.getByRole('group', { name: '键位 #68' })).toHaveTextContent('6,700');
  expect(screen.queryByRole('button', { name: /Function，第/ })).not.toBeInTheDocument();
  const primary = screen.getByRole('button', { name: /Primary，第 35 键，/ });
  fireEvent.keyDown(primary, { key: 'ArrowDown', altKey: true });
  expect(primary).toHaveFocus();
  expect(store.getState().layer).toBe(0);
});

test('offline import and backup restore retain their model and update the page tools', async () => {
  const models = [defaultModel, test68], backups = memoryBackups(models);
  const profile = modelFixture();
  const id = await backups.save(profile);
  const { store, actions, download } = application(null, backups, {}, { models });
  const tools: { tool: ModelTool; signal: AbortSignal }[] = [];
  render(<App store={store} />);
  await act(() => actions.start({ registerTool: (tool, options) => tools.push({ tool, ...options }) }));
  expect(tools).toHaveLength(3);
  await act(() => actions.importFile(profileFile(profile)));
  expect(store.getState().model).toBe(test68);
  expect(store.getState().canWrite).toBe(false);
  expect(tools).toHaveLength(6);
  expect(tools.slice(0, 3).every(({ signal }) => signal.aborted)).toBe(true);
  actions.exportProfile();
  expect(download).toHaveBeenCalledWith('配置', profile.toJSON());
  await act(() => actions.importBackup(id));
  expect(store.getState().profile?.toJSON()).toEqual(profile.toJSON());
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(136);
});

test('connecting a different model preserves pending edits and requires loading the new device', async () => {
  const models = [defaultModel, test68];
  const atom = new FakeDevice(), next = new FakeDevice(modelFixture());
  const hid = new FakeHID([atom]);
  const { store, session, actions } = application(hid, memoryBackups(models), {}, { models });
  render(<App store={store} usbAvailable />);
  await act(async () => {
    await actions.start();
    await acceptRead(store);
  });
  await openDeviceEditor();
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'Command\nC' } });
  await act(async () => {
    hid.disconnect(atom);
    hid.connect(next);
    await acceptRead(store);
  });
  expect(session.model).toBe(test68);
  expect(session.lastRead?.profile.model).toBe(test68);
  expect(store.getState().model).toBe(defaultModel);
  expect(store.getState().canWrite).toBe(false);
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('Command\nC');
  let read: Promise<void>;
  act(() => { read = actions.read(); });
  await act(async () => {
    actions.confirm(true);
    await read;
  });
  expect(store.getState().model).toBe(test68);
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(136);
});
