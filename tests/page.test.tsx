// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { application, ready } from './store-helpers';
import { FakeDevice, FakeHID } from './helpers';

afterEach(cleanup);

test('React boots without WebHID and renders all 66 keys with disabled hardware controls', async () => {
  const { store, actions } = application();
  render(<App store={store} notices={['当前浏览器不支持 WebHID。']} />);
  await act(() => actions.start());
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '写入键盘' })).toBeDisabled();
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(66);
  expect(screen.getByText('当前环境无法连接 USB')).toBeInTheDocument();
  expect(screen.getByText('当前浏览器不支持 WebHID。')).toBeInTheDocument();
});
test('demo editing, Fn tabs and reset update the React UI through Zustand', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.start());
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '离线演示' }));
  });
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'Command\nC' } });
  fireEvent.click(screen.getByRole('button', { name: '保存此键修改' }));
  expect(screen.getByRole('button', { name: /第 1 键 Esc，左 Command \+ C，已修改/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '写入键盘' })).toBeDisabled();
  fireEvent.mouseDown(screen.getByRole('tab', { name: '右 Fn' }), { button: 0, ctrlKey: false });
  expect(screen.getByRole('tab', { name: '右 Fn' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('');
  fireEvent.mouseDown(screen.getByRole('tab', { name: '普通层' }), { button: 0, ctrlKey: false });
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('左 Command\nC');
  fireEvent.click(screen.getByRole('button', { name: '还原此键' }));
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('Esc');
});
test('physical keyboard supports arrow selection and exposes counters', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  const first = screen.getByRole('button', { name: /第 1 键 Esc/ });
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: /第 2 键 1，/ })).toHaveFocus();
  expect(store.getState().key).toBe(1);
  fireEvent.click(screen.getByRole('checkbox', { name: '显示按键计数' }));
  expect(store.getState().showCounts).toBe(true);
});
test('StrictMode does not duplicate HID connections, listeners or automatic reads', async () => {
  const device = new FakeDevice();
  const hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  render(
    <StrictMode>
      <App store={store} usbAvailable />
    </StrictMode>,
  );
  await act(async () => {
    await actions.start();
    await ready(store);
  });
  expect(device.openCount).toBe(1);
  expect(device.sent.filter((packet) => packet[1] === 0xf2)).toHaveLength(1);
  expect(screen.getByText(/已连接 · ATOM66/)).toBeInTheDocument();
});
test('shadcn confirmation dialog cancels a replacement and retains unsaved input', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'A' } });
  fireEvent.click(screen.getByRole('button', { name: '离线演示' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('A');
});
test('help uses a labelled dialog and can be dismissed', () => {
  const { store } = application();
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('button', { name: '打开使用说明' }));
  const dialog = screen.getByRole('dialog', { name: '使用说明' });
  expect(within(dialog).getByText(/九组记录完整保留/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
