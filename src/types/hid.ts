/** The configuration interface only; ordinary keyboard input is never exposed. */
export interface HIDReport {
  reportId: number;
  items?: { reportSize: number; reportCount: number }[];
}
export interface HIDCollection {
  usagePage: number;
  usage: number;
  children?: HIDCollection[];
  inputReports?: HIDReport[];
  outputReports?: HIDReport[];
}
export interface ConfigDevice extends EventTarget {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  collections: HIDCollection[];
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: Uint8Array): Promise<void>;
}
export interface HIDAccess extends EventTarget {
  getDevices(): Promise<ConfigDevice[]>;
  requestDevice(options: {
    filters: { vendorId: number; productId: number; usagePage: number; usage: number }[];
  }): Promise<ConfigDevice[]>;
}
export interface HIDInputReportEvent extends Event {
  device: ConfigDevice;
  reportId: number;
  data: DataView;
}
export interface HIDConnectionEvent extends Event {
  device: ConfigDevice;
}
export type ConnectionState =
  'waiting' | 'unsupported' | 'authorizing' | 'connecting' | 'connected' | 'error';
export type TransferProgress = {
  completed: number;
} & (
  // Null means the input stream has not advertised a total. Never infer a
  // packet count from physical keys: macros can span multiple packets.
  { unit: 'packets'; total: number | null } | { unit: 'bytes'; total: number }
);
export interface OperationProgress {
  phase:
    | 'read' | 'verify' | 'counters' | 'readLights' | 'backup'
    | 'write' | 'writeLights' | 'settle' | 'readback' | 'readbackLights' | 'validate' | 'done';
  transfer?: TransferProgress;
}
