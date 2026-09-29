# Calibration support feasibility

**English** · [简体中文](calibration-research.zh-CN.md)

Research date: 2026-09-28. This note investigates an explicitly initiated calibration workflow in NIZ Web. It is not a hardware validation result or a declaration of support. No keyboard was connected, read, calibrated, reset, or flashed during this investigation; vendor programs were inspected as files and were not executed.

For concrete scope, session behavior, cleanup rules, and delivery batches, see the [implementation plan](calibration-implementation-plan.md).

Availability update, 2026-09-30: at the user's request, the configured ATOM66 combinations are now available by default in development and production builds. This supersedes the gated rollout recommendation below; the protocol evidence and outstanding hardware-validation limits are unchanged. See the current [user guide](usage.md#key-calibration).

**Conclusion:** there is enough protocol evidence to build a local experimental calibration workflow. The older and 2026 calibration DLLs contain identical machine code, and both expose release calibration, held-key calibration, and lock/unlock commands that fit the app's existing report transport. Production support still needs validation on the target ATOM66 firmware, especially completion replies, persistence, and recovery when unlocking fails. The recommended scope is a separate guided tool, qualified by model and firmware.

## Scope and evidence levels

The initial target is the ATOM66 device identified in the [actuation-setting investigation](actuation-readback-research.md): `66EC-S`, VID `0x0483`, PID `0x522A`, firmware `66EC(S);V1.4.4;V1.0;`. Those identifiers came from the earlier user-provided information, not a device query in this investigation.

Scope update, 2026-09-30: the user's screenshot identifies another ATOM66 variant, `66EC-XRGB`, VID `0x0483`, PID `0x502A`, firmware `66EC(XRGB)BLe;V1.2.5;V1.0;`. This exact combination is also enabled as a candidate based on the same static CalibrationLite command evidence below. That is an engineering inference, not a firmware-specific vendor guarantee. The screenshot establishes the reported identity, not calibration reply behavior, persistence or recovery; no hardware calibration was performed.

Evidence is distinguished throughout this note:

| Level | What it establishes |
| --- | --- |
| Official instructions or download listing | What NIZ publishes or distributes; not proof that every listed tool works on the target firmware |
| Static vendor-client analysis | What the inspected EXE or DLL constructs and handles; not a complete firmware specification |
| Engineering inference or proposal | A possible integration design, conditional on the stated assumptions |
| Hardware validation | Actual observed device behavior; none was performed for this note |

Three functions need separate names and support claims:

| Function | Meaning and evidence |
| --- | --- |
| Capacitance/key calibration | Re-establish released-key and pressed-key calibration. NIZ presents CalibrationLite as a way to address abnormal triggering; the current package explains a release stage followed by a held-key stage. [Support article](https://www.nizkeyboard.com/blogs/news/some-keys-doesn-t-work-look-at-this), [2026 package](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view) |
| Actuation/trigger-point selection | Select the trigger setting through a keyboard function. The model-specific manual and the limits of current-setting readback are covered in the [separate investigation](actuation-readback-research.md). Calibration is not evidence of a millimeter setting or its readback. |
| Key configuration | Map keys, macros, layers, and related configuration data through the existing editor and write transaction. That is the implemented [configuration architecture](architecture.md#devices-editing-and-writing); calibration must not be treated as another keymap field. |

## Current official distribution

The [NIZ firmware page](https://www.nizkeyboard.com/pages/firmware-upgrade) separately links ATOM66 files and **CalibrationLite Download（win and mac）**. Its [calibration directory](https://drive.google.com/drive/folders/10brHTpjXS-cU2HYCsKpm9cFY5skUeEDQ) still contains the older Windows and Mac distributions. The [official FAQ](https://www.nizkeyboard.com/blogs/news/faq) points to the [overall download directory](https://drive.google.com/drive/folders/1MqQE4e2JKO8qT765Njj5Y2gKxznoY4aY), which also contains a separate `NIZ-EC-CalibrationLite-2026.rar` file. Thus, checking only the long-standing calibration subdirectory misses the newer package.

| Official location | Observed files or scope | What remains unproven |
| --- | --- | --- |
| [Older Windows directory](https://drive.google.com/drive/folders/1vFULx-aiuiXIQwPm4ggazsiHACR2zEUE) | `CalibrationLite.exe`, `KBDLL.dll`, MFC/C runtime DLLs | Exact supported model/firmware matrix |
| [Mac directory](https://drive.google.com/drive/folders/16MtzGdINrANBTKhv2xSNrI4aOMlJtG4S) | `MACv1.0.2.dmg` | Current macOS compatibility and equivalence with either Windows package |
| [2026 package](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view) | `CalibrationLite.exe`, `KBDLL.dll`, six runtime DLLs, bilingual `使用说明Instructions.txt` | No explicit ATOM66/V1.4.4 support statement or firmware compatibility table in the included text |
| [DRT directory](https://drive.google.com/drive/folders/1a1gk-rxyLPWGmraL0a-ZNcDibGVzDlAK) | Separately named software families for Atom68pro, Micro82pro, mini84, S104, X87pro, X99, and X108pro | These names do not establish a shared calibration protocol or ATOM66 compatibility |

These are distribution families, not a verified generational compatibility matrix. In particular, the `2026` archive name does not establish a release date, protocol generation, or universal model coverage. Its instructions refer to `KeyCalibrationTool V1.0`, whereas the included executable is named `CalibrationLite.exe`.

Newer hardware also has different documented behavior: NIZ's [i84 ALU product page](https://www.nizkeyboard.com/products/i84-al) advertises automatic capacitance calibration at startup. This is evidence for that advertised product, not for the ATOM66 firmware and not a reason to add automatic calibration on application connection.

## Official calibration procedure

The bilingual instructions included in the [2026 package](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view) prescribe this sequence, paraphrased:

1. Connect the keyboard, open the tool, and verify that it reports a connected keyboard.
2. Release every key, then run **ReleaseCalib** once. The instructions say this stage covers all keys together.
3. Hold the one or several keys that need pressed-state calibration, then run **PressCalib**.
4. Keep those keys held until the completion prompt appears; only then release them.

The text does **not** require pressing every key, and it does not specify a key-travel distance, force, scan timing, calibration-storage format, backup command, recovery after interruption, or version compatibility. The held-key completion condition should be retained; a fixed UI timer cannot substitute for a device completion signal.

The older [official troubleshooting article](https://www.nizkeyboard.com/blogs/news/some-keys-doesn-t-work-look-at-this) recommends CalibrationLite, but its remaining numbered steps refer to `Step-1.png` and `Step-2.png` under the former `wp-content/uploads/2019/07/` path. Both image URLs returned HTTP 404 during this investigation. Consequently, that page alone no longer supplies a recoverable detailed procedure. The 2026 instructions are the usable first-party procedural evidence inspected here; they must not silently be represented as instructions tested on the older ATOM66 firmware.

## Protocol established by static analysis

The [older DLL](https://drive.google.com/file/d/17WC9k3V1y9xSvDaBNjdLQc4mr36xaWeY/view) and the DLL in the [2026 package](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view) have different whole-file hashes, but their entire `.text` sections are identical: 8,704 bytes, SHA-256 `a26b7e701e4962f5e693f16627b05370ca3d6b7132f7839b9c7ea952565a7d90`. Their 12 exports also have the same addresses. This establishes the same inspected client communication code; it does not prove unchanged firmware behavior.

The DLL zeroes a 65-byte Windows HID buffer, including the separate leading Report ID byte, and writes it through `WriteFile`. In the app's WebHID convention, use Report ID `0` separately and a **64-byte payload**; the prefixes below start at payload byte zero and all remaining bytes are zero. Do not send the Windows Report ID as an extra payload byte. The receive loop uses `ReadFile`; no feature-report calibration path was found in these exports.

| Operation | WebHID payload prefix | DLL export / RVA | Incoming code recognized by the client |
| --- | --- | --- | --- |
| Identify firmware | `00 F9 00` | `GetVersion` / `0x12D0` | `F9` |
| Lock normal key output | `00 D9 00` | `Keylock(0)` / `0x13C0` | No dedicated lock acknowledgement identified |
| Calibrate released state | `00 DB 00` | `CalibrationInit` / `0x1320` | `DA`: release/initial calibration completion |
| Calibrate held keys | `00 DD 00` | `CalibrationPress` / `0x1370` | `DE`: pressed-state calibration completion |
| Unlock normal key output | `00 D9 01` | `Keylock(1)` / `0x13C0` | No dedicated unlock acknowledgement identified |

The DLL checks `F9`, `DA`, and `DE` at RVAs `0x1172`, `0x118A`, and `0x11A2`, forwarding the latter two as window messages `0x7EB` and `0x7EC`. In the 2026 EXE, message-map entries at RVAs `0x1507C8` and `0x1507E0` route those messages to handlers at `0x24B0` and `0x24F0`. Those handlers display release/press completion text and do not inspect the forwarded payload. The [older EXE](https://drive.google.com/file/d/1Y4ADVyphBBKAMaqh_u1JI913lVWnj7mt/view) follows the same pattern at handlers `0x22E0` and `0x2430`.

Consequences for a port:

- Wait for the expected `DA` or `DE` notification. A successful send, fixed delay, unrelated packet, or repeated notification is not sufficient to complete another stage. Full response framing, timing, payload meaning, and error cases still need captures from the target firmware.
- The inspected requests carry no transaction ID. After a timeout, do not immediately send another calibration and attribute a late reply to it; first establish a clean recovery boundary. Response correlation limits must be recorded rather than hidden by a retry loop.
- `CalibrationPress` sends no key ID or selection mask. The tool asks the user to hold the physical keys to be calibrated. Selecting a key on the web layout cannot be represented as targeting the command to that key.
- The inspected clients do not decode per-key success, capacitance, or millimeter travel. Completion notifications do not justify a live sensor display, a per-key success map, or a progress percentage; unknown payload fields remain unknown.
- Neither inspected calibration DLL exports a calibration read/export/restore function. That does not prove the firmware lacks one, but it leaves no established calibration-backup route for this integration.

The 2026 EXE locks keys on its connection event (`Keylock(0)` call at RVA `0x231D`) and attempts unlocking on window close (`Keylock(1)` at `0x21AE`). **Do not copy connection-triggered locking into NIZ Web.** Start it only inside an explicitly confirmed calibration session. The DLL's device discovery checks `vid_0483` and `mi_01` strings; this broad filter must not replace the app's configuration-interface and firmware-based model identification.

Community implementations corroborate the basic operations: [`niz-tools-ruby`](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/niz.rb) defines `D9`/`DB`/`DD`, and [`nizctl`](https://github.com/NickCao/nizctl/blob/91aad9db8672595426c158704def428734109801/src/keyboard.rs) implements the same actions. These are primary sources for those clients, not vendor firmware specifications. The Rust pressed-calibration method reads a response without validating its opcode; the Ruby UI does not await initialization completion. Their transport buffers and completion handling should not be copied directly.

## Browser feasibility and constraints

**Engineering inference:** the inspected commands fit [`PacketChannel`](../src/hid.ts), which already uses `sendReport(0, 64-byte payload)` and input-report events. The [ATOM66 model](../src/devices/atom66/model.ts) selects usage page `0x8C`, usage `1`; `validateDescriptor` requires 64-byte input and output reports with Report ID `0`. Confirm that calibration uses this same accessible collection on the target firmware before treating transport compatibility as demonstrated.

WebHID provides output reports, input-report events, and bidirectional feature reports. `sendReport()` resolving confirms transmission, not calibration completion. Chrome blocks reports belonging to protected top-level collections, including generic keyboard and mouse usages, so a usable vendor interface must be selected instead of assuming access to the ordinary typing interface. `HIDDevice.collections` exposes report information. [Chrome WebHID documentation](https://developer.chrome.com/docs/capabilities/hid)

The [WebHID specification](https://wicg.github.io/webhid/) restricts the API to secure contexts. First permission acquisition through `requestDevice()` requires transient user activation and the `hid` permissions-policy allowance. Existing grants can be enumerated with `getDevices()`. These requirements fit the app's current explicit USB-connect button and persisted permissions; calibration must remain a separate explicit operation after identification. [Specification source: permission algorithms](https://github.com/WICG/webhid/blob/main/index.html)

The integration should feature-detect WebHID and validate the actual interface/report layout. Operating-system access also matters: Chrome documents Linux `hidraw` permission requirements. Successfully transferring key configurations does not by itself prove that a calibration interface or report is available on every supported platform. [Chrome WebHID documentation](https://developer.chrome.com/docs/capabilities/hid)

The pure-browser design can remain local: confirmed HID commands can be implemented in TypeScript without loading the Windows DLL, embedding vendor executables, or adding a background device proxy. This is an implementation proposal, not a claim of a completed port. It preserves the existing [standalone build and connection model](architecture.md).

## Proposed integration

This is a design proposal, not implemented behavior. Keep calibration separate from `Profile`, the key editor, and the existing configuration-write transaction.

| Area | Proposed change and reason |
| --- | --- |
| [`src/devices/model.ts`](../src/devices/model.ts), ATOM66 definition | Add a calibration capability with an explicit validated model/firmware policy. Default to unavailable. The existing `version.startsWith('66EC')` model match is not a calibration compatibility guarantee. |
| New `src/calibration.ts` | Keep command construction, expected replies, stages, deadlines, and errors independent of React. Model release and held-key calibration separately; do not use configuration read/write or scan unknown opcodes. |
| [`src/hid.ts`](../src/hid.ts) | Let `HIDSession` own one exclusive calibration session bound to the exact device and connection epoch, including time waiting for user actions. Prevent configuration traffic and device switching from interleaving. Track a possibly locked device and provide bounded cleanup. |
| [`src/store/app-store.ts`](../src/store/app-store.ts) | Add calibration state/actions and message identifiers. Preserve every device's loaded configuration, drafts, and undo history. A reconnect invalidates authorization to continue the old calibration. |
| [`src/components/`](../src/components/) | Add a device-specific calibration entry and a short guided dialog. Reuse AlertDialog, Button, shared tokens, and the lock illustration. Extend operation state deliberately: the current overlay handles only `read` and `write` and has no interactive calibration stages. |
| [`src/i18n/`](../src/i18n/), user guides | Add matching Chinese/English text and explicit recovery wording. Keep calibration unavailable through WebMCP. |

The initial UI can have three steps:

1. **Release all keys.** Explain that normal typing will be locked and the user will operate the controls with a mouse or trackpad. Confirmation focuses Cancel by default. Only **Start calibration** authorizes `D9 00`, then `DB`; wait for release completion. Connecting or opening the tool sends neither command. A confirmation activated with the target keyboard needs a separate all-keys-released step before dispatch; do not sample while the confirming Enter/Space is still held.
2. **Hold the keys that need calibration.** The user holds one or several affected keys firmly and clicks **Calibrate held keys**. Send `DD` and keep the held-key instruction visible until `DE`. Allow another user-requested batch or proceeding to finish; do not require all keys to be pressed, and do not automatically repeat release calibration.
3. **Finish and test.** Attempt `D9 01`, then let the user test normal typing in a focused local test area. Distinguish device-reported calibration completion, successful unlock transmission, and observed key behavior. None alone proves that all sensors are correct or values are durably saved.

Keep unrelated page content inert and focus inside the active dialog. During device work, Escape and backdrop clicks cannot dismiss it. Between completed stages, an explicit **End calibration and unlock** action can end the session; this is not rollback. On failure, release the page lock and keep an actionable error visible. Use stage text and an indeterminate waiting state, not fabricated percentages. Keyboard navigation can use another keyboard; all controls must remain usable with a pointing device while the target keyboard is locked. These choices follow the project's [interaction requirements (Chinese)](../AGENTS.md).

### Cleanup and data boundaries

[`PacketChannel.send`](../src/hid.ts) permanently marks its channel failed on a send error or timeout; subsequent sends fail immediately. Therefore, adding `finally { unlock() }` alone is insufficient. The design must specify whether the original device/epoch and transport still permit a bounded cleanup attempt. Never clear the error and blindly continue, unlock a different device, or replay calibration after reconnection. A timeout can leave a send's physical outcome unknown.

No dedicated unlock acknowledgement was identified. Record failed or uncertain cleanup honestly. Do not guarantee recovery after forced tab closure, a browser crash, sleep, or cable removal; neither `finally` nor an unload handler can provide that guarantee. A tested manual recovery procedure is a release prerequisite. Merely returning control to the page does not prove that the keyboard is unlocked.

[`Profile.toJSON`](../src/protocol.ts) stores key reports, counters, optional lighting, and compatibility data; [`BackupStore`](../src/storage.ts) saves that JSON. It has no identified calibration snapshot. A keymap backup can preserve key assignments but cannot promise restoration of calibration. Do not invent an automatic calibration rollback or overwrite these formats. Keep the existing baseline check → external-change read → backup transaction → write → readback sequence unchanged for configuration writes. Entering calibration must not automatically read a key configuration; that remains an explicit existing read action.

If hardware observations show calibration changes data used by the configuration baseline, invalidate that device's hardware baseline while preserving its editor and drafts, and require the existing explicit reread flow before a later write. Do not reload the editor automatically at the end of calibration.

## Implementation and validation order

1. **Now: build the local experimental protocol and simulated workflow.** Keep production calibration unavailable. Test exact 64-byte buffers and padding, lock polarity, `DB → DA` / `DD → DE`, no sends on cancellation, wrong/stale replies, timeouts, duplicate clicks, device/epoch changes, exclusive ownership, and cleanup errors. Test that all editors/drafts survive, background/focus locks are correct, and Chinese/English layouts work. Run the project's normal `npm run check` for any implementation changes.
2. **Before production enablement: validate the target firmware.** In a separately authorized hardware session, first match its descriptor and firmware. Record the applicable official tool's complete input/output sequence with timestamps, report IDs, all bytes, and annotated user actions; calibration actually changes device state. Keep captures outside the repository. Confirm stage framing and duration, no hidden command or separate interface, and whether the device persists calibration on completion or on exit. Do not probe unknown opcodes or flash firmware to fill gaps.
3. **Then validate the browser workflow and recovery.** With real ATOM66 hardware, test released-state calibration, affected-key batches, completion, normal typing, reconnection/power-cycle persistence, and preservation of mappings. Establish a recovery procedure before intentionally testing interruptions; then cover unplugging, tab closure, timeout, and uncertain unlock outcomes. Validate each advertised browser/OS combination. Configuration comparisons must use the existing explicit read confirmation, not a new automatic read.

Enable only the exact model/firmware combinations that pass this validation. Simulated replies prove application sequencing, not sensor calibration, flash persistence, or WebHID availability. No real-device result is claimed by this report. A universal NIZ calibrator, analog travel display, millimeter editor, and current-actuation readback remain separate tasks.

## Reproducibility

The official 2026 archive was downloaded and extracted in a temporary directory. No executable or DLL was loaded. SHA-256 identifies the exact inspected files:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `NIZ-EC-CalibrationLite-2026.rar` | 5,417,486 | `87d1f2ac8f77c99244fa8cffc23c7ef9987aa8b1f4a0a8c41c4e1c8d53dc63ce` |
| `CalibrationLite.exe` | 1,835,008 | `86d5a16164761ecf88817b5d9afa992f989741db9e784cdd7efa3ae5bf2a2a9a` |
| `KBDLL.dll` | 17,408 | `4a73d74f378b5d6c0b731257eb6432482e8184efc27e7f611161db8a6e12fe32` |
| `使用说明Instructions.txt` | 1,060 | `0a03d04e337e23d7b72ef3c75e3c7c5d245d289b0f6dbbd23966c9db67212bf6` |

The older comparison files have SHA-256 `c40e164fdbc022ad96b786c78bfbc0bf8aede527a72a8991598c3807c9a71b5f` (`KBDLL.dll`) and `580049eadb6e331f44627214bbca136d540dede3f6e2367b6d6bb22de3d0b90d` (`CalibrationLite.exe`). Analysis used PE sections, import/export tables, MFC message maps, string references, and x86 disassembly. Example static inspection commands after downloading the official files to a temporary directory:

```sh
shasum -a 256 '/absolute/path/to/KBDLL.dll'
objdump -p '/absolute/path/to/KBDLL.dll'
objdump -d --x86-asm-syntax=intel --start-address=0x100012d0 --stop-address=0x10001410 '/absolute/path/to/KBDLL.dll'
objdump -d --x86-asm-syntax=intel --start-address=0x4024b0 --stop-address=0x402530 '/absolute/path/to/2026/CalibrationLite.exe'
```

The bilingual instructions use a legacy Chinese encoding (GBK-compatible); interpreting them as UTF-8 corrupts the Chinese text. No vendor artifacts, private captures, or disassembly were added to the project. This task changes research documentation only.

The two older image failures, current Google Drive folder contents, and product statements above were checked on the research date. They describe that bounded inspection, not all historical NIZ documentation.
