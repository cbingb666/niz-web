import { fireEvent, screen } from '@testing-library/react';

export async function chooseMappingType(label: string) {
  // jsdom has no scrolling; Radix scrolls the focused select option into view.
  HTMLElement.prototype.scrollIntoView ??= () => {};
  fireEvent.keyDown(screen.getByRole('combobox', { name: /^(映射类型|Mapping type)$/ }), { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: label }), { key: 'Enter' });
}
