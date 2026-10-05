export const actionGroups = ['all', 'common', 'letters', 'navigation', 'function', 'mac', 'media', 'mouse', 'lighting', 'device', 'reserved'] as const;
export type ActionGroup = (typeof actionGroups)[number];
export type MappingView = 'key' | 'chord' | 'advanced';
export type PickerScope = 'key' | 'chord';
export interface ActionPickerState {
  query: string;
  group: ActionGroup;
  highlight: number;
  scrollTop: number;
}
export interface MappingScrollAnchor {
  code: number;
  offset: number;
}
export interface MappingBrowser {
  view: MappingView;
  pickers: Record<PickerScope, ActionPickerState>;
  contentScroll: Record<MappingView, number>;
  contentAnchors: Partial<Record<MappingView, MappingScrollAnchor>>;
  recentActions: number[];
}
export function emptyMappingBrowser(): MappingBrowser {
  const picker = (): ActionPickerState => ({ query: '', group: 'all', highlight: 0, scrollTop: 0 });
  return {
    view: 'key',
    pickers: { key: picker(), chord: picker() },
    contentScroll: { key: 0, chord: 0, advanced: 0 },
    contentAnchors: {},
    recentActions: [],
  };
}
