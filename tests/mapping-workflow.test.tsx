// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { chooseMappingType, openDeviceEditor } from './page-helpers';
import { application, acceptRead, profileFile } from './store-helpers';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { renderMessage, translate } from '../src/i18n/core';
import { keyDescription, localizedKeyName } from '../src/i18n/key-names';
import type { ModelTool } from '../src/model-tools';

// Radix measures the checkbox's hidden form input; jsdom does not implement layout observers.
beforeAll(() => vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
}));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

test.each(['zh-CN', 'en'] as const)('%s brightness descriptions keep the original actions and names', async locale => {
  const { store, actions } = application(null, undefined, { locale });
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  for (const query of ['屏幕亮度', 'screen brightness']) {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
    expect(view.container.querySelectorAll('.action-option')).toHaveLength(2);
  }
  for (const [code, name] of [[79, 'Scroll Lock'], [80, 'Pause']] as const) {
    const option = screen.getByRole('button', { name: label => label.startsWith(name) });
    expect(within(option).getByText(keyDescription(code, locale)!)).toHaveClass('action-description');
    fireEvent.click(option);
    expect(store.getState().profile!.definition(0).keys).toEqual([code]);
    expect(store.getState().form.sequence).toBe(name);
    expect(view.container.querySelector('.mapping-preview figcaption')).toHaveTextContent(keyDescription(code, locale)!);
  }
  await chooseMappingType(translate(locale, 'mapping.advanced'));
  expect(view.container.querySelector('option[value="Pause · #80"]')?.getAttribute('label')).toContain(keyDescription(80, locale));
});

test('long function labels use matching abbreviations in the keyboard and selected-key preview', async () => {
  const { store, actions } = application();
  const profile = fixture();
  profile.setDefinition(66, { type: 0, keys: [167] });
  profile.setDefinition(132, { type: 0, keys: [152] });
  profile.counters[0] = 1_200_000;
  const view = render(<App store={store} />);
  await act(() => actions.importFile(profileFile(profile)));
  const key = screen.getByRole('group', { name: '键位 #1' });
  expect(key.querySelector('.key-front .assignment')).toHaveTextContent('Wire/WL');
  expect(key.querySelector('.key-layer[data-layer="2"] .assignment')).toHaveTextContent('Caps/Ctrl');
  fireEvent.click(within(key).getByRole('button', { name: '左 Fn，第 1 键，Caps / Ctrl 切换' }));
  const preview = view.container.querySelector('.mapping-preview .keycap-sample')!;
  expect(preview.querySelector('.key-front .assignment')).toHaveTextContent('Wire/WL');
  expect(preview.querySelector('.key-layer[data-layer="2"] .assignment')).toHaveTextContent('Caps/Ctrl');
  expect(key).not.toHaveTextContent('#152');
  expect(preview).not.toHaveTextContent('#167');
  for (const legend of view.container.querySelectorAll('.key-legend')) expect(legend.textContent).not.toMatch(/\p{Script=Han}/u);
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  expect(within(key).getByText('1.2M')).toBeVisible();
  expect(screen.getByRole('figure', { name: '键帽区域说明' })).toHaveTextContent('Count');
  const legends = Array.from(view.container.querySelectorAll('.key-legend'), element => element.textContent);
  await act(() => actions.setLocale('en'));
  expect(Array.from(view.container.querySelectorAll('.key-legend'), element => element.textContent)).toEqual(legends);
});

test.each(['zh-CN', 'en'] as const)('%s mapping choices show muted abbreviations and search them without changing key codes', async locale => {
  const { store, actions } = application(null, undefined, { locale });
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  expect(screen.getByRole('button', { name: 'C' }).querySelector('.key-abbreviation')).toBeNull();
  const search = screen.getByRole('searchbox');
  const fullName = localizedKeyName(155, locale);
  for (const query of [fullName, 'Win/Mac']) {
    fireEvent.change(search, { target: { value: query } });
    const option = screen.getByRole('button', { name: name => name.startsWith(fullName) });
    const hint = within(option).getByText('Win/Mac');
    expect(hint).toHaveClass('key-abbreviation');
    expect(hint).toHaveAttribute('aria-hidden', 'true');
    expect(hint).toBeVisible();
  }
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(store.getState().profile!.definition(0).keys).toEqual([155]);
  expect(view.container.querySelector('.mapping-preview .keycap-sample')).toHaveTextContent('Win/Mac');
  fireEvent.change(search, { target: { value: 'BSeq-' } });
  expect(screen.getByRole('button', { name: name => name.startsWith(localizedKeyName(142, locale)) })).toBeVisible();

  await chooseMappingType(translate(locale, 'mapping.advanced'));
  const option = view.container.querySelector('option[value$=" · #155"]');
  expect(option).toHaveAttribute('value', `${fullName} · #155`);
  expect(option).toHaveAttribute('label', translate(locale, 'mapping.abbreviation', { name: 'Win/Mac' }));
});

test.each(['zh-CN', 'en'] as const)('%s editors share sided names while preserving legacy search and key codes', async locale => {
  const { store, actions } = application(null, undefined, { locale });
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  expect(screen.getByRole('button', { name: 'L Ctrl' })).toBeVisible();
  const search = screen.getByRole('searchbox');
  for (const name of ['R Ctrl', '右 Control', 'Right Control']) {
    fireEvent.change(search, { target: { value: name } });
    expect(screen.getByRole('button', { name: /^R Ctrl/ })).toBeVisible();
  }
  fireEvent.click(screen.getByRole('button', { name: /^R Ctrl/ }));
  expect(store.getState().profile!.definition(0).keys).toEqual([74]);
  expect(view.container.querySelector('.mapping-preview .keycap-sample')).toHaveTextContent('R Ctrl');

  await chooseMappingType(translate(locale, 'mapping.chord'));
  for (const name of ['L Ctrl', 'R Ctrl', 'L Cmd', 'R Cmd', 'L Alt', 'R Alt', 'L Shift', 'R Shift'])
    expect(screen.getByRole('checkbox', { name })).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'L Cmd' }));
  fireEvent.click(screen.getByRole('button', { name: 'C' }));
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'mapping.useChord') }));
  expect(store.getState().profile!.definition(0).keys).toEqual([74, 68, 58]);

  await chooseMappingType(translate(locale, 'mapping.advanced'));
  const choices = view.container.querySelector('#key-options');
  expect(choices?.querySelector('option[value="L Fn · #166"]')).not.toBeNull();
  expect(choices?.querySelector('option[value="R Fn · #156"]')).not.toBeNull();
  fireEvent.change(screen.getByLabelText(translate(locale, 'editor.addKey')), { target: { value: 'R Shift · #66' } });
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'editor.appendKey') }));
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'editor.save') }));
  expect(store.getState().profile!.definition(0).keys).toEqual([74, 68, 58, 66]);
  expect(store.getState().form.sequence).toBe('R Ctrl\nL Cmd\nC\nR Shift');
});

test('mapping type select switches all editors while preserving unapplied input', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  expect(screen.queryByRole('combobox', { name: '映射类型' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  await act(() => actions.demo());
  const original = store.getState().profile!.toJSON();
  expect(screen.getByRole('combobox', { name: '映射类型' })).toHaveTextContent('按键');
  await chooseMappingType('系统功能');
  expect(screen.getByRole('button', { name: '下一曲' })).toBeInTheDocument();
  await chooseMappingType('快捷键');
  expect(screen.getByRole('button', { name: '按下快捷键录入' })).toBeInTheDocument();
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'unfinished' } });
  await chooseMappingType('按键');
  expect(screen.queryByLabelText(/按键序列/)).not.toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: '选择目标功能' })).toBeInTheDocument();
  await chooseMappingType('宏 / 高级');
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished');
  expect(store.getState().formDirty).toBe(true);
  expect(store.getState().profile!.toJSON()).toEqual(original);
});

test('key numbers are opt-in on the layout and guide, appear only in the editor caption, and are independent of counts', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  const view = render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  await openDeviceEditor();
  const sent = device.sent.slice();
  const original = store.getState().profile!.toJSON();
  const layout = view.container.querySelector('.keyboard')!;
  const guide = screen.getByRole('figure', { name: '键帽区域说明' });
  const toggle = screen.getByRole('checkbox', { name: '显示编码' });
  expect(toggle).not.toBeChecked();
  expect(layout.querySelector('.key-number')).toBeNull();
  expect(guide.querySelector('.key-number')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^左 Fn，第 2 键，/ }));
  act(() => actions.updateForm({ view: 'advanced', sequence: 'unfinished' }));
  const editor = screen.getByRole('figure', { name: '映射编辑' });
  expect(editor.querySelector('.key-number')).toBeNull();
  expect(within(editor).getByText('键位 #2')).toBeVisible();
  expect(within(editor).getByText('左 Fn')).toBeVisible();
  fireEvent.click(toggle);
  expect(layout.querySelectorAll('.key-number')).toHaveLength(66);
  expect(guide.querySelector('.key-number')).toHaveTextContent('#01');
  expect(editor.querySelector('.key-number')).toBeNull();
  expect(within(editor).getByText('键位 #2')).toBeVisible();
  expect(within(editor).getByText('左 Fn')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  fireEvent.click(toggle);
  expect(screen.getByRole('checkbox', { name: '显示计数' })).toBeChecked();
  expect(layout.querySelector('.key-number')).toBeNull();
  expect(guide.querySelector('.key-number')).toBeNull();
  expect(editor.querySelector('.key-number')).toBeNull();
  expect(store.getState()).toMatchObject({ key: 1, layer: 2, draftIndices: [133], showKeyNumbers: false });
  expect(store.getState().profile!.toJSON()).toEqual(original);
  expect(device.sent).toEqual(sent);
});

test('No action is first in common actions, updates the keycap preview, and Restore recovers the loaded mapping', async () => {
  const device = new FakeDevice();
  device.profile.setDefinition(66, { type: 0, keys: [44] });
  const { store, actions } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  await openDeviceEditor();
  const original = store.getState().profile!.toJSON();
  const sent = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 1 键，/ }));
  const editor = screen.getByRole('complementary', { name: '选中按键设置' });
  expect(within(editor).queryByRole('button', { name: /清空按键/ })).not.toBeInTheDocument();
  expect(within(editor).queryByRole('combobox', { name: '编辑层' })).not.toBeInTheDocument();
  const options = within(editor.querySelector<HTMLElement>('.action-options')!).getAllByRole('button');
  expect(options[0]).toHaveAccessibleName('无功能');
  const preview = within(editor).getByRole('figure', { name: '映射编辑' });
  expect(within(preview).getByText('键位 #1')).toBeVisible();
  expect(within(preview).getByText('右 Fn')).toBeVisible();
  expect(within(preview.querySelector<HTMLElement>('figcaption')!).getByText('S')).toBeVisible();
  fireEvent.click(options[0]);
  expect(store.getState().changes).toEqual([66]);
  expect(store.getState().profile!.definition(66).keys).toEqual([0]);
  expect(preview.querySelector('.key-front .assignment')).toHaveTextContent('∅');
  expect(within(preview.querySelector<HTMLElement>('figcaption')!).getByText('无功能')).toBeVisible();
  expect(within(editor).getByRole('button', { name: '还原' })).toBeEnabled();
  fireEvent.click(within(editor).getByRole('button', { name: '还原' }));
  expect(store.getState().profile!.toJSON()).toEqual(original);
  expect(within(preview.querySelector<HTMLElement>('figcaption')!).getByText('S')).toBeVisible();
  expect(within(editor).getByRole('button', { name: '还原' })).toBeDisabled();
  expect(device.sent).toEqual(sent);
});

test('mapping preview follows selected position, active layer, language and undo without adding editable keys', async () => {
  const { store, actions } = application();
  const view = render(<App store={store} />);
  expect(screen.queryByRole('figure', { name: '映射编辑' })).not.toBeInTheDocument();
  await act(() => actions.demo());
  fireEvent.click(screen.getByRole('button', { name: /^左 Fn，第 30 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: 'C' }));
  const preview = screen.getByRole('figure', { name: '映射编辑' });
  expect(preview.querySelector('.key-number')).toBeNull();
  expect(within(preview).getByText('键位 #30')).toBeVisible();
  expect(within(preview).getByText('左 Fn')).toBeVisible();
  expect(within(preview.querySelector<HTMLElement>('figcaption')!).getByText('C')).toBeVisible();
  expect(preview.querySelector('[data-preview-active="true"]')).toHaveAttribute('data-layer', '2');
  expect(within(preview).queryByRole('button')).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('.key-layer[aria-pressed="true"]')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '撤销' }));
  expect(within(preview.querySelector<HTMLElement>('figcaption')!).getByText('未设置')).toBeVisible();
  act(() => actions.setLocale('en'));
  const englishPreview = screen.getByRole('figure', { name: 'Mapping editor' });
  expect(within(englishPreview).getByText('Position #30')).toBeVisible();
  expect(within(englishPreview).getByText('Left Fn')).toBeVisible();
  expect(within(englishPreview.querySelector<HTMLElement>('figcaption')!).getByText('Unassigned')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
});

test('modified dots follow each layer in the keyboard and preview through restore and undo', async () => {
  const { store, actions } = application();
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  const key = screen.getByRole('group', { name: '键位 #30' });
  const dotLayers = (element: Element) => Array.from(element.querySelectorAll('.key-change-dot'), dot => {
    expect(dot.parentElement).toHaveClass('assignment');
    return Number(dot.closest('.key-layer')?.getAttribute('data-layer'));
  }).sort();
  const expectLayers = (layers: number[]) => {
    expect(dotLayers(key)).toEqual(layers);
    expect(dotLayers(view.container.querySelector('.mapping-preview .keycap-sample')!)).toEqual(layers);
    expect(key.querySelector(':scope > .key-change-dot')).toBeNull();
  };
  for (const [layer, expected] of [[0, [0]], [2, [0, 2]], [1, [0, 1, 2]]] as const) {
    act(() => { actions.selectKey(29, layer); actions.assignKey(58); });
    expectLayers([...expected]);
  }
  fireEvent.click(screen.getByRole('button', { name: '还原' }));
  expectLayers([0, 2]);
  fireEvent.click(screen.getByRole('button', { name: '撤销' }));
  expectLayers([0, 1, 2]);
  fireEvent.click(screen.getByRole('button', { name: '重做' }));
  expectLayers([0, 2]);
});

test('count view replaces front-edge mappings with counts and orders key brightness without hardware writes', async () => {
  const device = new FakeDevice();
  device.profile.counters = Array.from({ length: 66 }, (_, index) => [0, 100, 10_000, 0xffffffff][index] ?? 0);
  const { store, actions } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  await openDeviceEditor();
  act(() => { actions.selectKey(0, 1); actions.assignKey(58); });
  const sent = device.sent.slice();
  const profile = store.getState().profile!.toJSON();
  expect(screen.queryByRole('group', { name: '编辑层' })).not.toBeInTheDocument();
  expect(screen.queryByText(/正在编辑：/)).not.toBeInTheDocument();
  const guide = screen.getByRole('figure', { name: '键帽区域说明' });
  expect(within(guide).queryByRole('list')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  expect(screen.queryByRole('button', { name: /^右 Fn，第/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /第 \d+ 键，/ })).toHaveLength(132);
  const positions = [1, 2, 3, 4].map(position => screen.getByRole('group', { name: `键位 #${position}` }));
  expect(within(positions[0]).queryByRole('img', { name: '已修改' })).not.toBeInTheDocument();
  expect(guide.querySelector('.key-front .key-change-dot')).toBeNull();
  expect(positions[0].querySelector('.key-front')).toHaveTextContent('0');
  expect(positions[1].querySelector('.key-front')).toHaveTextContent('100');
  expect(positions[2].querySelector('.key-front')).toHaveTextContent('10,000');
  expect(within(positions[3]).getByLabelText('按键计数：4,294,967,295')).toBeVisible();
  const brightness = positions.map(position => Number(position.style.getPropertyValue('--count-face').match(/[\d.]+/)![0]));
  expect(brightness[0]).toBeLessThan(brightness[1]);
  expect(brightness[1]).toBeLessThan(brightness[2]);
  expect(brightness[2]).toBeLessThan(brightness[3]);
  expect(guide).toHaveTextContent('Count');
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  expect(screen.getAllByRole('button', { name: /^右 Fn，第/ })).toHaveLength(66);
  expect(within(positions[0]).getByRole('img', { name: '已修改' }).closest('.key-layer')).toHaveAttribute('data-layer', '1');
  expect(guide).toHaveTextContent('R Fn');
  expect(store.getState().profile!.toJSON()).toEqual(profile);
  expect(device.sent).toEqual(sent);
});

test.each([false, true])('count view handles missing or all-zero counters without invented data (zeros: %s)', async zeros => {
  const { store, actions } = application();
  const profile = fixture();
  profile.counters = zeros ? Array(66).fill(0) : [];
  const view = render(<App store={store} />);
  await act(() => actions.importFile(profileFile(profile)));
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  const keys = Array.from(view.container.querySelectorAll<HTMLElement>('.key'));
  expect(new Set(keys.map(key => key.style.getPropertyValue('--count-face')))).toEqual(new Set(['rgb(44 44 44)']));
  expect(keys.every(key => key.querySelector('.key-front')?.textContent === (zeros ? '0' : '—'))).toBe(true);
});

test('count mode preserves right-Fn drafts and keyboard navigation skips the hidden mapping', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 2 键，/ }));
  act(() => actions.updateForm({ view: 'advanced', sequence: 'unfinished' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  expect(store.getState()).toMatchObject({ key: 1, layer: 0, draftIndices: [67] });
  fireEvent.keyDown(screen.getByRole('button', { name: /^普通层，第 2 键，/ }), { key: 'ArrowDown', altKey: true });
  const left = screen.getByRole('button', { name: /^左 Fn，第 2 键，/ });
  expect(left).toHaveFocus();
  fireEvent.keyDown(left, { key: 'ArrowUp', altKey: true });
  expect(screen.getByRole('button', { name: /^普通层，第 2 键，/ })).toHaveFocus();
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 2 键，/ }));
  expect(screen.getByRole('checkbox', { name: '显示计数' })).not.toBeChecked();
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished');
  expect(screen.getByRole('button', { name: /^右 Fn，第 2 键，/ })).toHaveAttribute('aria-pressed', 'true');
});

test('3D key surfaces edit the corresponding normal, left Fn and right Fn records', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.click(screen.getByRole('checkbox', { name: '显示编码' }));
  const key = screen.getByRole('group', { name: '键位 #1' });
  const face = within(key.querySelector<HTMLElement>('.key-face')!);
  const front = within(key.querySelector<HTMLElement>('.key-front')!);
  expect(key.querySelector('.key-side')).toHaveTextContent('#01');
  expect(face.getByRole('button', { name: /^普通层，第 1 键，/ })).toBeVisible();
  expect(face.getByRole('button', { name: /^左 Fn，第 1 键，/ })).toBeVisible();
  fireEvent.click(front.getByRole('button', { name: /^右 Fn，第 1 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: 'C' }));
  expect(store.getState().profile!.definition(66).keys).toEqual([58]);
  fireEvent.click(face.getByRole('button', { name: /^左 Fn，第 1 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: 'V' }));
  expect(store.getState().profile!.definition(132).keys).toEqual([59]);
  expect(store.getState().profile!.definition(0).keys).toEqual([1]);
});

test('numbered positions expose all layers together without assuming printed key legends', async () => {
  const { store, actions } = application();
  const profile = fixture();
  profile.setDefinition(0, { type: 0, keys: [43] });
  profile.setDefinition(66, { type: 0, keys: [44] });
  profile.setDefinition(132, { type: 0, keys: [58] });
  const view = render(<App store={store} />);
  await act(() => actions.importFile(profileFile(profile)));
  fireEvent.click(screen.getByRole('checkbox', { name: '显示编码' }));
  const position = screen.getByRole('group', { name: '键位 #1' });
  expect(within(position).getAllByRole('button')).toHaveLength(3);
  expect(position.querySelector('.key-number')).toHaveTextContent('#01');
  expect(position).not.toHaveTextContent('Esc');
  expect(within(position).getByRole('button', { name: '普通层，第 1 键，A' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(position).getByRole('button', { name: '右 Fn，第 1 键，S' })).toBeVisible();
  expect(within(position).getByRole('button', { name: '左 Fn，第 1 键，C' })).toBeVisible();
  expect(view.container.querySelectorAll('.key-layer[aria-pressed="true"]')).toHaveLength(1);
  expect(view.container.querySelectorAll('[data-active-layer]')).toHaveLength(0);
  fireEvent.click(within(position).getByRole('button', { name: '左 Fn，第 1 键，C' }));
  expect(store.getState()).toMatchObject({ key: 0, layer: 2 });
  expect(within(position).getByRole('button', { name: '左 Fn，第 1 键，C' })).toHaveAttribute('aria-pressed', 'true');
  expect(view.container.querySelectorAll('.key-layer[data-layer="2"][aria-pressed="true"]')).toHaveLength(1);
  expect(view.container.querySelectorAll('.key[data-selected="true"]')).toHaveLength(1);
  expect(view.container.querySelectorAll('[data-active-layer]')).toHaveLength(0);
  expect(screen.getAllByRole('button', { name: /第 \d+ 键，/ })).toHaveLength(198);
  fireEvent.click(screen.getByRole('button', { name: 'Esc' }));
  expect(store.getState().profile!.definition(132).keys).toEqual([1]);
  expect(store.getState().profile!.definition(0).keys).toEqual([43]);
  expect(store.getState().profile!.definition(66).keys).toEqual([44]);
});

test('keycap selection and keyboard navigation select the same key-layer pair without an editor layer switch', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const { store, actions } = application();
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  expect(screen.queryByRole('combobox', { name: '编辑层' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 1 键，/ }));
  expect(store.getState().layer).toBe(1);
  expect(view.container.querySelectorAll('.key-layer[data-layer="1"][aria-pressed="true"]')).toHaveLength(1);
  expect(view.container.querySelectorAll('[data-active-layer]')).toHaveLength(0);
  const first = screen.getByRole('button', { name: /^右 Fn，第 1 键，/ });
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  const second = screen.getByRole('button', { name: /^右 Fn，第 2 键，/ });
  expect(second).toHaveFocus();
  fireEvent.keyDown(second, { key: 'ArrowDown', altKey: true });
  expect(screen.getByRole('button', { name: /^左 Fn，第 2 键，/ })).toHaveFocus();
  expect(store.getState()).toMatchObject({ key: 1, layer: 2 });
  expect(view.container.querySelectorAll('.key-layer[aria-pressed="true"]')).toHaveLength(1);
  expect(view.container.querySelectorAll('.key[data-selected="true"]')).toHaveLength(1);
  expect(first.closest('.key')).toHaveAttribute('data-selected', 'false');
});

test('layer-specific drafts and changes remain visible alongside other layers', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 30 键，/ }));
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'unfinished' } });
  fireEvent.click(screen.getByRole('button', { name: /^普通层，第 30 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Esc' }));
  expect(screen.getByRole('button', { name: /^普通层，第 30 键，/ })).toHaveClass('changed');
  expect(screen.getByRole('button', { name: /^普通层，第 30 键，/ }).querySelector('.key-change-dot')).not.toBeNull();
  expect(screen.getByRole('button', { name: /^右 Fn，第 30 键，/ })).toHaveClass('has-draft');
  expect(screen.getByRole('button', { name: /^右 Fn，第 30 键，/ }).querySelector('.key-change-dot')).toBeNull();
  expect(screen.getByRole('button', { name: /^左 Fn，第 30 键，/ })).not.toHaveClass('changed', 'has-draft');
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 30 键，/ }));
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished');
});

test('Caps to Esc stages in two selections, can be undone and previews the real difference', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.click(screen.getByRole('button', { name: /普通层，第 30 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Esc' }));
  expect(store.getState().changes).toEqual([29]);
  expect(store.getState().profile!.definition(29).keys).toEqual([1]);
  expect(screen.queryByRole('textbox', { name: /按键序列/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '撤销' }));
  expect(store.getState().changes).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: '重做' }));
  fireEvent.click(screen.getByRole('button', { name: '查看全部改动' }));
  const dialog = screen.getByRole('dialog', { name: '待写入改动' });
  const row = within(dialog).getAllByRole('row')[1];
  expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Caps Lock', 'Esc']);
  expect(store.getState().canWrite).toBe(false);
});

test('unfinished edits survive navigation and block export, tools and hardware write', async () => {
  const device = new FakeDevice();
  const { store, actions, download } = application(new FakeHID([device]));
  const tools: ModelTool[] = [];
  await actions.start({ registerTool: tool => tools.push(tool) });
  await acceptRead(store);
  actions.assignKey(43);
  actions.updateForm({ type: '2', sequence: 'A @30\nnot-a-key', customDelay: true });
  actions.selectKey(1, 1);
  actions.assignKey(58);
  const sent = device.sent.slice();
  await actions.write();
  actions.exportProfile();
  expect(() => tools.find(tool => tool.name === 'atom66_stage_key_edits')!.execute({ edits: [{ layer: 0, key: 2, type: 0, sequence: 'B' }] })).toThrow();
  expect(device.sent).toEqual(sent);
  expect(download).not.toHaveBeenCalled();
  expect(store.getState().canWrite).toBe(false);
  expect(store.getState().dialog).toBeNull();
  actions.setLocale('en');
  actions.selectKey(0, 0);
  expect(store.getState().form.sequence).toBe('A @30\nnot-a-key');
  expect(actions.saveForm()).toBe(false);
  expect(renderMessage(store.getState().formError, 'en')).toContain('Unknown key');
  actions.discardForm();
  expect(store.getState().draftIndices).toEqual([]);
  expect(store.getState().canWrite).toBe(true);
});

test('a background layer draft cannot be silently overwritten by Fn synchronization', async () => {
  const { store, actions } = application();
  await actions.demo();
  actions.selectKey(1, 2);
  actions.updateForm({ sequence: 'A\nB', type: '2' });
  actions.selectKey(1, 0);
  const before = store.getState().profile!.toJSON();
  actions.assignKey(156);
  expect(store.getState().profile!.toJSON()).toEqual(before);
  expect(renderMessage(store.getState().formError)).toContain('其他层');
  expect(store.getState().draftIndices).toEqual([133]);
});

test('keyboard search stages one target and shortcut capture only runs while explicitly armed', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  const search = screen.getByRole('searchbox', { name: '选择目标功能' });
  fireEvent.change(search, { target: { value: '空格' } });
  fireEvent.keyDown(search, { key: 'Enter', isComposing: true });
  expect(store.getState().changes).toEqual([]);
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(store.getState().profile!.definition(0).keys).toEqual([70]);
  await chooseMappingType('快捷键');
  const capture = screen.getByRole('button', { name: '按下快捷键录入' });
  fireEvent.keyDown(capture, { key: 'c', code: 'KeyC', ctrlKey: true });
  expect(store.getState().formDirty).toBe(false);
  fireEvent.click(capture);
  fireEvent.keyDown(capture, { key: 'c', code: 'KeyC', ctrlKey: true });
  expect(store.getState().formDirty).toBe(true);
  expect(store.getState().profile!.definition(0).keys).toEqual([70]);
  fireEvent.click(screen.getByRole('button', { name: '使用此快捷键' }));
  expect(store.getState().profile!.definition(0).keys).toEqual([67, 58]);
});

test('write confirmation includes parameter-level differences and cancellation has no device side effects', async () => {
  const device = new FakeDevice();
  device.profile.setDefinition(0, { type: 2, keys: [43, 44], interval: 30, cycles: 1, customDelay: 0 });
  const { store, actions } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  await openDeviceEditor();
  fireEvent.change(screen.getByLabelText('间隔（ms）'), { target: { value: '80' } });
  fireEvent.click(screen.getByRole('button', { name: '应用这次编辑' }));
  const sent = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: '核对并写入' }));
  const dialog = screen.getByRole('alertdialog', { name: '键盘将暂时锁定' });
  const cells = within(dialog).getAllByRole('cell');
  expect(cells[0]).toHaveTextContent('间隔 30 ms');
  expect(cells[1]).toHaveTextContent('间隔 80 ms');
  expect(device.sent).toEqual(sent);
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '取消' })));
  expect(device.sent).toEqual(sent);
  expect(store.getState().canUndo).toBe(true);
});

test('empty macro timing stays as an editable error rather than becoming zero', async () => {
  const { store, actions } = application();
  await actions.demo();
  actions.updateForm({ type: '2', sequence: 'A\nB', interval: '' });
  expect(actions.saveForm()).toBe(false);
  expect(store.getState().form.interval).toBe('');
  expect(store.getState().changes).toEqual([]);
});

test('numeric search distinguishes a key legend from an explicit wire code', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  const search = screen.getByRole('searchbox', { name: '选择目标功能' });
  fireEvent.change(search, { target: { value: '2' } });
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(store.getState().profile!.definition(0).keys).toEqual([16]);
  fireEvent.change(search, { target: { value: '#2' } });
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(store.getState().profile!.definition(0).keys).toEqual([2]);
});

test('returning to an unfinished text edit restores its editor as well as its contents', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  await chooseMappingType('宏 / 高级');
  expect(store.getState().formDirty).toBe(false);
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'not-ready' } });
  fireEvent.click(screen.getByRole('button', { name: /普通层，第 2 键，/ }));
  fireEvent.click(screen.getByRole('button', { name: /普通层，第 1 键，/ }));
  expect(screen.getByRole('combobox', { name: '映射类型' })).toHaveTextContent('宏 / 高级');
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('not-ready');
});
