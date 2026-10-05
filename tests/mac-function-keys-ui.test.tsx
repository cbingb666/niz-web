// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { MAC_NATIVE_VERSION, MAC_STOCK_VERSION } from '../src/mac-keycodes';
import { translate } from '../src/i18n/core';
import { fixture } from './helpers';
import { application, profileFile } from './store-helpers';

beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

test.each(['zh-CN', 'en'] as const)('%s one-click conversion includes hidden layers and exposes undo and draft guards', async locale => {
  const profile = fixture();
  profile.version = MAC_NATIVE_VERSION;
  const { store, actions } = application(null, undefined, { locale });
  const view = render(<App store={store} />);
  await act(() => actions.importFile(profileFile(profile)));
  act(() => {
    actions.updateActionPicker('key', { group: 'mac' });
    actions.setShowCounts(true);
  });
  const button = screen.getByRole('button', { name: translate(locale, 'mapping.macConvert') });
  expect(button).toBeEnabled();
  expect(button).toHaveAccessibleDescription(translate(locale, 'mapping.macConvertScope', { count: 24 }));
  fireEvent.click(button);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(store.getState()).toMatchObject({ changes: expect.any(Array), showCounts: true, key: 0, layer: 0 });
  expect(store.getState().changes).toHaveLength(24);
  expect(store.getState().profile!.definition(67).keys).toEqual([208]);
  expect(store.getState().profile!.definition(133).keys).toEqual([208]);
  expect(view.container.querySelector('.keyboard .key-layer[data-layer="1"]')).toBeNull();
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription(translate(locale, 'mapping.macConverted', { count: 24 }));
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'mapping.undo') }));
  expect(store.getState().changes).toEqual([]);
  expect(button).toBeEnabled();
  act(() => {
    actions.selectKey(1, 1);
    actions.updateForm({ sequence: 'unfinished input' });
    actions.selectKey(0, 0);
  });
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription(translate(locale, 'mapping.macConvertDrafts'));
});

test.each(['zh-CN', 'en'] as const)('%s unsupported firmware disables full conversion with one clear reason', async locale => {
  const profile = fixture();
  profile.version = MAC_STOCK_VERSION;
  const { store, actions } = application(null, undefined, { locale });
  render(<App store={store} />);
  await act(() => actions.importFile(profileFile(profile)));
  act(() => actions.updateActionPicker('key', { group: 'mac' }));
  const button = screen.getByRole('button', { name: translate(locale, 'mapping.macConvert') });
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription(translate(locale, 'mapping.macConvertFirmware'));
  expect(store.getState().changes).toEqual([]);
});
