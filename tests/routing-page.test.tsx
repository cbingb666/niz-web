// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, onTestFinished, test, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { App } from '../src/app';
import { bindRouting } from '../src/routing';
import { translate } from '../src/i18n/core';
import { application } from './store-helpers';
import { chooseMappingType } from './page-helpers';

const initialUrl = window.location.href;
afterEach(() => { cleanup(); window.history.replaceState(null, '', initialUrl); });

test('the chooser and demo update real hash history and browser Back and Forward retain the loaded profile', async () => {
  window.history.replaceState(null, '', '#/connect');
  const { store } = application(), routing = bindRouting(store, window);
  onTestFinished(routing.dispose);
  await routing.ready;
  render(<App store={store} />);
  expect(screen.getByRole('heading', { name: translate('zh-CN', 'guide.supportTitle') })).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  expect(window.location.hash).toBe('#/demo?model=atom66&from=connect');
  const entries = window.history.length;
  fireEvent.click(screen.getByRole('radio', { name: 'ATOM68' }));
  expect(window.history.length).toBe(entries);
  expect(window.location.hash).toBe('#/demo?model=atom68&from=connect');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始演示' })); });
  expect(window.location.hash).toBe('#/demo/atom68');
  const before = store.getState().profile?.toJSON(), generation = store.getState().generation;
  await act(async () => {
    window.history.back();
    await vi.waitFor(() => expect(store.getState().page).toBe('demo'));
  });
  expect(screen.getByRole('radio', { name: 'ATOM68' })).toBeChecked();
  await act(async () => {
    window.history.forward();
    await vi.waitFor(() => expect(store.getState().page).toBe('editor'));
  });
  expect(store.getState().profile?.toJSON()).toEqual(before);
  expect(store.getState().generation).toBe(generation);
});

test('cancelling browser Back restores the real URL and keeps unfinished inputs', async () => {
  window.history.replaceState(null, '', '#/demo?model=atom68');
  const { store } = application(), routing = bindRouting(store, window);
  onTestFinished(routing.dispose);
  await routing.ready;
  render(<App store={store} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始演示' })); });
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'unfinished macro' } });
  const before = store.getState().profile?.toJSON();
  await act(async () => {
    window.history.back();
    await vi.waitFor(() => expect(store.getState().dialog?.kind).toBe('confirm'));
  });
  await act(async () => {
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '取消' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/demo/atom68'));
  });
  expect(store.getState().page).toBe('editor');
  expect(store.getState().form.sequence).toBe('unfinished macro');
  expect(store.getState().profile?.toJSON()).toEqual(before);
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished macro');
});

test.each(['https://niz.example/niz-web/', 'file:///private/tmp/niz-web.html'])('hash routing keeps the original path for %s', async url => {
  const dom = new JSDOM('', { url: `${url}#/connect` }), { store, actions } = application();
  const routing = bindRouting(store, dom.window);
  onTestFinished(() => { routing.dispose(); dom.window.close(); });
  await routing.ready;
  await actions.navigate('demo');
  await actions.demo('atom68');
  expect(dom.window.location.href).toBe(`${url}#/demo/atom68`);
  dom.window.history.back();
  await vi.waitFor(() => expect(store.getState().page).toBe('demo'));
  expect(store.getState().demoReturnPage).toBe('connect');
});
