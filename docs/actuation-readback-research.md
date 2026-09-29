# ATOM66 actuation-setting readback feasibility

**English** · [简体中文](actuation-readback-research.zh-CN.md)

Research date: 2026-09-28. This is a feasibility investigation, not a hardware validation result or a supported feature.

## Scope and current conclusion

The target reported by the user is ATOM66, product name `66EC-S`, VID `0x0483`, PID `0x522A`, firmware `66EC(S);V1.4.4;V1.0;`. These identifiers were provided by the user; this investigation did not query the device.

The question is whether software can read the **currently selected actuation/trigger-point setting** over USB HID. A key assignment that invokes trigger adjustment, per-key calibration data, and live physical key travel are different data.

The inspected configuration and calibration DLLs provide **no identified current-setting query or decoder**. This conclusion comes from tracing their report construction and receive paths, as well as reviewing public documentation. There is no established method ready to integrate into NIZ Web. Readback on the user's exact firmware remains **unconfirmed**: these findings cannot prove that `V1.4.4` lacks an unexposed response field or command.

## Confirmed public-source findings

### The model-specific manual documents adjustment, not a readback protocol

NIZ's [official firmware page](https://www.nizkeyboard.com/pages/firmware-upgrade) links its [ATOM66 folder](https://drive.google.com/drive/folders/1uFy1kPoQUHyo8z_4PXmxHVeTmqxKPgX0). That folder contains a [User Manual folder](https://drive.google.com/drive/folders/18UQ4VyLRHLeljHfmk_KgcIS-pS1vxnSK) with separate wired, Bluetooth, and Bluetooth RGB documents.

The wired [`66EC(S) User Manual.doc`](https://drive.google.com/file/d/1k3Vg7hB_TJU9YnCvDY_zkc43GSpnhRkG/view), under “Special keys Function table,” assigns trigger adjustment to **Right Fn + 7**. It describes high/low stages and says the choice does not survive shutdown. It does not identify a firmware version, exact millimeter values, or a command for querying the selected stage. Its configuration section covers key assignments, configuration files, counters, and firmware-version reading; no current trigger-setting display is documented. This document alone cannot establish the number of stages or persistence behavior on `V1.4.4`.

The downloaded wired manual is 460,288 bytes; SHA-256: `0dab546c18993b5b249b71a00cf6bb6031dfd696f68212b571b3fbc7dd115884`. The document was inspected as text, without executing vendor software.

Manuals are not interchangeable. Epomaker's [ATOM66 manual page](https://epomaker.com/blogs/manuals/niz-atom-66-manual), dated September 1, 2022, links [`66EC(S)Ble User Manual`](https://epomaker.com/cdn/shop/files/66EC_S_Ble_User_Manual.pdf?v=17780642986330550205), whose first-page table also uses Right Fn + 7 and high/low wording. In contrast, the [Epomaker NiZ Plum 66/68 Extended Manual v1.0](https://m.media-amazon.com/images/I/81lXmBjwZoL.pdf), page 5, lists Fn + quote and high/middle/low. This discrepancy is evidence to match the manual to the actual hardware and firmware, rather than assigning an assumed stage count or millimeter value.

### The available firmware does not exactly match the user's version

The official [ATOM66 EC-S firmware folder](https://drive.google.com/drive/folders/1lv1Lf1l5OfxAzrov6kNhhUXUO0VyLr7p) lists dated subfolders through `2023.6`. The three newest inspected folders contain:

| Folder | Firmware filename | Source |
| --- | --- | --- |
| `2021.04 update` | `66EC(S)_V1.1.6_20210307.bin` | [File](https://drive.google.com/file/d/1_3UJmkrOrEUX-kGYxpIg5neVAXUpJagV/view) |
| `2022.8` | `66EC(S)_V1.1.8_20220505.bin` | [File](https://drive.google.com/file/d/11fQhR7fw6tEppPS3f4h3EDluJBGiFTg1/view) |
| `2023.6` | `66EC(S)_V1.4.1_20230520.bin` | [File](https://drive.google.com/file/d/1aa0uQIqgfIYKPJRzSkNzxXRXpG14anTX/view) |

`V1.4.4` was not found in the inspected EC-S listing. This is a bounded search result, not a claim that no vendor copy exists elsewhere. None of these firmware files was flashed or executed. Analysis of an earlier firmware would need confirmation against the user's version.

The [official ATOM66 software folder](https://drive.google.com/drive/folders/1TKMJdtVenduhFT4T0OSxVlmQR5W7BFey) lists `66EC(XRGB)Ble.exe`, `66EC(XRGB)BleHWI.dll`, and `66EC(XRGB)BleRES.dll`, the same filenames as the repository's [reference software](../drivers/README.md). The downloaded HWI DLL differs from the bundled one; both were inspected below. Their PE headers contain timestamps in 2022 and 2018 respectively, but those timestamps do not establish release dates or firmware coverage.

### Calibration is a separate avenue, not evidence of current-setting readback

NIZ's [calibration support article](https://www.nizkeyboard.com/blogs/news/some-keys-doesn-t-work-look-at-this) presents CalibrationLite as a repair tool for key-trigger problems. Its [firmware page](https://www.nizkeyboard.com/pages/firmware-upgrade) separately links [CalibrationLite downloads](https://drive.google.com/drive/folders/10brHTpjXS-cU2HYCsKpm9cFY5skUeEDQ). The [Windows folder](https://drive.google.com/drive/folders/1vFULx-aiuiXIQwPm4ggazsiHACR2zEUE) contains [`CalibrationLite.exe`](https://drive.google.com/file/d/1Y4ADVyphBBKAMaqh_u1JI913lVWnj7mt/view) and [`KBDLL.dll`](https://drive.google.com/file/d/17WC9k3V1y9xSvDaBNjdLQc4mr36xaWeY/view). The public page does not document a selected-stage query or the meaning of calibration response fields.

Community source is useful as evidence of what that implementation does, but is not a NIZ firmware specification. At revision `185077c4de8a22c9d66431e12990b08dfa5154a1`, [`niz-tools-ruby/niz.rb`](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/niz.rb) labels keycode `149` as trigger adjustment and implements calibration initialization and pressed-key calibration separately from configuration reads. Its [`calib.rb`](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/calib.rb) asks the user to release or press keys for those operations; it does not decode a current actuation-stage value. Its [README example](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/README.md) identifies firmware `66EC(S)BLe;V1.0.37;V1.0;`, which differs from the target.

Likewise, [`nizctl/src/keyboard.rs`](https://github.com/NickCao/nizctl/blob/91aad9db8672595426c158704def428734109801/src/keyboard.rs), revision `91aad9db8672595426c158704def428734109801`, reads version, counters, and keymaps and exposes calibration actions, but has no selected-stage decoder. Neither project's absence of that decoder proves the firmware lacks one. Calibration commands must not be repurposed as supposedly read-only probes.

## Static binary findings

The analysis used PE import/export tables, string cross-references, and x86 disassembly. No vendor executable or DLL was loaded or run. Downloads and disassembly stayed in a temporary directory; the repository's vendor files were not replaced.

### Configuration DLLs

Both the [bundled HWI DLL](../drivers/ATOM66/66EC%28XRGB%29BleHWI.dll) and the [officially linked HWI DLL](https://drive.google.com/file/d/1NJQlk11EyqNYpbCyR7aVpTrMOS89vwMw/view) export the same 22 entry points. Tracing the ordinary read functions gives the following commands. Addresses are relative virtual addresses (RVAs), valid for both inspected copies.

| Purpose | Export → implementation RVA | Command-byte store RVA | WebHID command |
| --- | --- | --- | --- |
| Key definitions | `readKeyDefinationFromDev` `0x2390` → `0x14D0` | `0x150B` | `00 F2 …` |
| Per-key lighting | `readKeyLightFromDev` `0x23A0` → `0x1A80` | `0x1AA7` | `00 E2 …` |
| Key-use counters | `getPressCounterFromDev` `0x23F0` → `0x1B70` | `0x1B97` | `00 E3 …` |
| Firmware version | `ReadKeyboardVersion` `0x23D0` → virtual method `0x2460` | `0x2488` | `00 F9 …` |

The bundled DLL's I/O vtable at RVA `0xD47C` identifies `WriteFile` and `ReadFile` wrappers at `0x3A80` and `0x3AB0`. Windows uses a 65-byte buffer with an extra Report ID byte; the read wrapper removes that byte. The command values above use the project's 64-byte WebHID convention. The other traced sends belong to configuration writes, lighting writes, their terminators, or firmware transfer, not an actuation-state getter. The DLL imports `HidD_GetHidGuid` but no `HidD_GetFeature`/`HidD_SetFeature`; the inspected dynamic lookups resolve runtime/Windows helpers, not another HID query API.

The key read loop processes `F0` definitions and ends on `F6`. Lighting/counter loops copy their respective byte streams and end on `E6`. The version routine converts its response to text. None of these paths interprets a selected actuation stage. These findings describe the client implementation; they do not establish the meaning of ignored bytes emitted by the firmware.

In the [bundled EXE](../drivers/ATOM66/66EC%28XRGB%29Ble.exe), the assignment-table construction stores keycode `0x95` (149) at RVA `0x23EA5`, alongside references to the Chinese trigger-switch label and “Adjust Trigger Point” at RVAs `0x23EBA` and `0x23EFB`. This corroborates the [project's key assignment](../src/devices/atom66/legacy.ts), not a millimeter value or current stage.

### Calibration DLL

The official [`KBDLL.dll`](https://drive.google.com/file/d/17WC9k3V1y9xSvDaBNjdLQc4mr36xaWeY/view) exports 12 functions. Its four report-building methods are:

| Export / RVA | Command | Observed purpose |
| --- | --- | --- |
| `GetVersion` / `0x12D0` | `F9` | Version request |
| `CalibrationInit` / `0x1320` | `DB` | Start calibration |
| `CalibrationPress` / `0x1370` | `DD` | Calibrate pressed keys |
| `Keylock` / `0x13C0` | `D9` with an argument | Change keyboard lock state |

The receive thread compares response codes `F9`, `DA`, and `DE` at RVAs `0x1172`, `0x118A`, and `0x11A2`, then forwards payloads to the application window. These are incoming codes, not evidence that sending `DA` or `DE` queries a setting. No selected-stage getter or decoder was identified in this DLL. Calibration changes are outside the proposed read-only comparison.

### Reproducibility

SHA-256 identifies the exact files inspected:

| File | SHA-256 |
| --- | --- |
| Bundled `66EC(XRGB)BleHWI.dll` | `c2502d5bf939c298df4b120891ed93b0507b6ea43a17844d41030a846bb41bec` |
| Bundled `66EC(XRGB)Ble.exe` | `fac3fe86c0e8f6b6d5addd4d4ebc250ba3f434b198a0da255dc3abbebe4ff4d3` |
| Official download `66EC(XRGB)BleHWI.dll` | `1ca6c2141ff2aac1d38c03533ac56a64c27beb9e4e82eae9a1f6c9abf5c108d3` |
| Official download `KBDLL.dll` | `c40e164fdbc022ad96b786c78bfbc0bf8aede527a72a8991598c3807c9a71b5f` |

For example, these commands inspect the bundled DLL without executing it (LLVM `objdump`):

```sh
shasum -a 256 'drivers/ATOM66/66EC(XRGB)BleHWI.dll'
objdump -p 'drivers/ATOM66/66EC(XRGB)BleHWI.dll'
objdump -d --x86-asm-syntax=intel --start-address=0x100014d0 --stop-address=0x10001580 'drivers/ATOM66/66EC(XRGB)BleHWI.dll'
```

The downloaded `V1.4.1` firmware is a 114,718-byte colon-prefixed hexadecimal-text update file, SHA-256 `d7b961633fc4ebe973cc29020418a216e7acea0b6dceddf068cc987faaf2f0a2`. Its container was inspected, but its firmware command dispatcher was not reconstructed. It does not substitute for an analysis of `V1.4.4`.

## What remains unknown

- Whether `V1.4.4` returns a stage value in an existing response, its trailing bytes, a stream terminator, or a spontaneous input report.
- Whether an additional vendor command can query the value, including through the separate calibration interface.
- Whether any such value identifies a global stage, per-key threshold, or calibration measurement, and whether its meaning is stable across firmware versions.
- The exact stage count, millimeter interpretation, and persistence rules for the user's version.

The [architecture](architecture.md#compatible-formats) records nine key-configuration groups for `V1.4.4`. Their count is not evidence of three actuation stages. No source reviewed connects these groups to the current trigger setting.

## Why existing diagnostic exports cannot settle this

The current [`readVersion`](../src/hid.ts) returns only the decoded version string. `readKeyReports` retains `F0` key packets but discards the `F6` terminator. [`makeCapture`](../src/protocol.ts) serializes those key packets and the version string; it is not a full bidirectional traffic recording. Counter/RGB replies and spontaneous reports are outside that capture. Therefore, identical existing diagnostic exports would show only that the captured key packets did not change; they would not rule out state elsewhere in HID traffic.

## Proposed verification using known reads

This procedure has not been performed. It should use the user's actual `66EC(S);V1.4.4;V1.0;` device and keep private captures outside the repository.

1. Record the firmware, product name, USB interface and report descriptors, current Office/Program mode, and the device-specific indication used to identify each stage. Preserve the original state so it can be restored manually after the comparison.
2. Capture full traffic with timestamps, direction, report ID, and all bytes, including full version replies, terminators, padding, and unsolicited input. First observe a manual trigger-stage change without sending configuration commands. Then repeat only established read operations through the app's existing explicit read confirmation and operation lifecycle. For this non-RGB model, the implemented queries are `F9`, `F2`, and `E3`; do not add an `E2` RGB query or calibration/lock commands. Wait for the read to finish and the keyboard to be usable before the user changes the stage. Recording must happen before parsing or filtering; a full USB capture can provide this, whereas the app's existing diagnostic export cannot.
3. Read stage A twice without changing settings (A/A). Have the user change only the trigger stage, then read B and return to A (A/B/A). Repeat each available stage. Keep the connection and other settings constant; do not power-cycle between samples if that resets the stage.
4. Use control observations to distinguish stage-dependent bytes from key-use counters, transaction state, elapsed time, and other setting changes. A byte that changes once is insufficient. A candidate should return reproducibly with the stage and remain unaffected by unrelated controls.
5. If a candidate is found, verify it across reconnects and power cycles separately, while observing the actual resulting stage. Test the raw report semantics before adding a firmware-scoped decoder. Label an enumerated stage as a stage unless millimeter values are independently established.
6. If no candidate appears, conclude only that the tested read paths and passive reports did not expose it. Further progress would require a documented vendor query or static analysis of matching firmware/calibration tooling. Do not scan unknown opcodes, invoke calibration, reset the keyboard, write mappings, or flash firmware to answer this question.

No hardware read/write, browser WebHID validation, calibration, or firmware update was performed for this note. No runtime code was changed. The practical next step is a complete A/A and A/B/A traffic comparison on the target firmware; a production decoder should wait for reproducible evidence.
