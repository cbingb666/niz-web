// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { defaultModel } from '../src/devices';
import type { ModelTool } from '../src/model-tools';
import { FakeDevice, FakeHID } from './helpers';
import { modelFixture, test68 } from './model-fixtures';
import { application, memoryBackups, profileFile, ready } from './store-helpers';

afterEach(cleanup);

test('connection renders the loaded geometry, layers and counters and edits the correct record', async () => {
  const models = [defaultModel, test68];
  const device = new FakeDevice(modelFixture(test68, 4));
  const { store, actions } = application(new FakeHID([device]), memoryBackups(models), {}, { models });
  const tools: ModelTool[] = [];
  render(<App store={store} usbAvailable />);
  await act(async () => {
    await actions.start({ registerTool: (tool) => tools.push(tool) });
    await ready(store);
  });
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(68);
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByText('4 组记录完整保留 · 编辑前 2 组')).toBeInTheDocument();
  expect(tools.at(-2)?.inputSchema).toMatchObject({ properties: { layer: { maximum: 1 } } });
  fireEvent.click(screen.getByRole('button', { name: /第 68 键 K68/ }));
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Function' }), { button: 0, ctrlKey: false });
  expect(store.getState().key).toBe(67);
  expect(store.getState().layer).toBe(1);
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'C' } });
  fireEvent.click(screen.getByRole('button', { name: '保存此键修改' }));
  expect(store.getState().profile?.definition(135).keys).toEqual([58]);
  expect(store.getState().changes).toEqual([135]);
  const last = screen.getByRole('button', { name: /第 68 键 K68/ });
  fireEvent.keyDown(last, { key: 'ArrowUp' });
  expect(screen.getByRole('button', { name: /第 35 键 K35/ })).toHaveFocus();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示按键计数' }));
  expect(last).toHaveTextContent('6,700');
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
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(68);
});

test('connecting a different model preserves pending edits and requires loading the new device', async () => {
  const models = [defaultModel, test68];
  const atom = new FakeDevice(), next = new FakeDevice(modelFixture());
  const hid = new FakeHID([atom]);
  const { store, session, actions } = application(hid, memoryBackups(models), {}, { models });
  render(<App store={store} usbAvailable />);
  await act(async () => {
    await actions.start();
    await ready(store);
  });
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'Command\nC' } });
  await act(async () => {
    hid.disconnect(atom);
    hid.connect(next);
    await ready(store);
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
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(68);
});
