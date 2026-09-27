import { act, fireEvent, screen } from '@testing-library/react';

export function confirmSupportedModel() {
  fireEvent.click(screen.getByRole('checkbox', { name: /^(我已确认设备型号在支持列表中|I have confirmed that my device model is listed)$/ }));
  fireEvent.click(screen.getByRole('button', { name: /^(确认型号，下一步|Model confirmed — next)$/ }));
}

export async function openDeviceEditor() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^(配置设备|Configure device)$/ })); });
}

export async function chooseMappingType(label: string) {
  // jsdom has no scrolling; Radix scrolls the focused select option into view.
  HTMLElement.prototype.scrollIntoView ??= () => {};
  fireEvent.keyDown(screen.getByRole('combobox', { name: /^(映射类型|Mapping type)$/ }), { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: label }), { key: 'Enter' });
}
