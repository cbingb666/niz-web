// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AppDialogs } from '../src/components/app-dialogs';
import { StoreContext } from '../src/store/context';
import { msg, translate, type Locale } from '../src/i18n/core';
import { ProtocolError } from '../src/protocol';
import { application, memoryBackups } from './store-helpers';
import { FakeDevice, FakeHID, fixture } from './helpers';

afterEach(cleanup);

test.each<Locale>(['zh-CN', 'en'])('backup deletion requires confirmation, preserves editing and returns to the list in %s', async locale => {
  const backups = memoryBackups();
  const first = await backups.save(fixture());
  const secondProfile = fixture();
  secondProfile.setDefinition(0, { type: 0, keys: [43] });
  const second = await backups.save(secondProfile, '写入前');
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]), backups, { locale });
  await actions.start();
  await actions.demo();
  actions.assignKey(43);
  actions.updateForm({ sequence: 'unfinished input' });
  const before = store.getState();
  const sent = device.sent.slice();
  render(<StoreContext.Provider value={store}><AppDialogs /></StoreContext.Provider>);
  await act(() => actions.showBackups());
  const dialog = screen.getByRole('dialog', { name: translate(locale, 'backup.title') });
  const firstDelete = within(dialog).getAllByRole('button', { name: translate(locale, 'backup.delete') })[0];
  fireEvent.click(firstDelete);
  const confirmation = screen.getByRole('alertdialog', { name: translate(locale, 'backup.deleteTitle') });
  expect(confirmation).toHaveTextContent(fixture().version);
  expect(confirmation).toHaveTextContent(translate(locale, 'backup.read'));
  expect(within(confirmation).getByRole('button', { name: translate(locale, 'common.cancel') })).toHaveFocus();
  expect(backups.remove).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(within(confirmation).getByRole('button', { name: translate(locale, 'common.cancel') })); });
  expect(store.getState().backupRows.map(row => row.id)).toEqual([first, second]);
  expect(backups.remove).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(document.getElementById(`backup-delete-${first}`)).toHaveFocus());

  fireEvent.click(document.getElementById(`backup-delete-${first}`)!);
  await act(async () => {
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: translate(locale, 'backup.delete') }));
  });
  expect(backups.remove).toHaveBeenCalledExactlyOnceWith(first);
  expect(store.getState().backupRows.map(row => row.id)).toEqual([second]);
  expect(await backups.list()).toHaveLength(1);
  expect(store.getState().profile?.toJSON()).toEqual(before.profile?.toJSON());
  expect(store.getState().drafts).toBe(before.drafts);
  expect(store.getState().changes).toEqual(before.changes);
  expect(store.getState().canUndo).toBe(before.canUndo);
  expect(device.sent).toEqual(sent);
  expect(screen.getByRole('dialog', { name: translate(locale, 'backup.title') })).toBeInTheDocument();

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: translate(locale, 'backup.delete') })); });
  await act(async () => {
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: translate(locale, 'backup.delete') }));
  });
  expect(screen.getByRole('dialog')).toHaveTextContent(translate(locale, 'backup.empty'));
});

test('failed deletion keeps the backup and reports an error that can be dismissed before retrying', async () => {
  const backups = memoryBackups();
  const id = await backups.save(fixture());
  vi.mocked(backups.remove).mockRejectedValueOnce(new ProtocolError(msg('error.storageTransaction')));
  const { store, actions } = application(null, backups, { locale: 'en' });
  render(<StoreContext.Provider value={store}><AppDialogs /></StoreContext.Provider>);
  await act(() => actions.showBackups());
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => {
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  });
  expect(screen.getByRole('dialog')).toHaveTextContent('try again');
  expect(store.getState().busy).toBe('');
  expect(store.getState().backupRows[0].id).toBe(id);
  expect(await backups.list()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  await act(() => actions.showBackups());
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => {
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  });
  expect(screen.getByRole('dialog')).toHaveTextContent('No backups yet');
});
