# Mac function-row feasibility

**English** · [简体中文](mac-function-keys-research.zh-CN.md)

Research date: 2026-10-05. Target confirmed by the user: ATOM66 / 66EC RGB BLE, firmware `66EC(RGB)BLe;V1.5.1;V1.0;`. These are static findings, not hardware qualification. No configuration or firmware was sent to a keyboard.

## Existing stock capabilities

The local decoded APROM SHA-256 was checked against `8ecb2cef8172ca37a5e42a75b2748af6a8c930c174c5ae6c67776207d13fa43a`. Its [USB mapping routine](../niz-firmware/recovered/firmware/decompiled/functions/0000a258_usb_key_event.c), [BLE mapping routine](../niz-firmware/recovered/firmware/decompiled/functions/0000329c_ble_key_event.c) and [ROM tables](../niz-firmware/firmware/src/rom.S) establish these internal-code mappings:

| Action | NIZ internal code | HID page / usage |
| --- | --- | --- |
| Screen brightness down / up | 208 / 209 | Consumer `0x0C / 0x70`, `0x0C / 0x6F` |
| Next / previous track | 108 / 109 | Consumer `0x0C / 0xB5`, `0x0C / 0xB6` |
| Play / pause | 111 | Consumer `0x0C / 0xCD` |
| Mute | 112 | Consumer `0x0C / 0xE2` |
| Volume up / down | 113 / 114 | Consumer `0x0C / 0xE9`, `0x0C / 0xEA` |
| Search, a Spotlight candidate | 119 | Consumer `0x0C / 0x221` (AC Search) |

Brightness table entries are at ROM `0xC46C..0xC46F`; media entries start at `0xC448`. USB Consumer Report ID 1 has a 16-bit array element and Usage/Logical Maximum `0x23C`, starting at `0xCD0C`. [Apple's consumer driver](https://github.com/apple-oss-distributions/IOHIDFamily/blob/main/IOHIDFamily/IOHIDConsumer.cpp) maps standard brightness, playback and volume usages to system events. Track skipping and held rewind/fast-forward are distinct; test the desired behavior separately.

At the initial investigation, the web app named 208 and 209 as reserved codes. Its [parser](../src/protocol.ts) accepts `#208` and `#209`, and its [action picker](../src/components/action-picker.tsx) can search these numeric codes. Thus the wire format already carries these stock brightness actions; adding a friendly picker entry does not require a firmware patch. Do not generalize the meanings to other models or firmware. Codes 144/145 control the NIZ keyboard's lighting, not the Mac display or Mac built-in keyboard backlight.

## Native system actions requiring extensions

[QMK's official mapping](https://github.com/qmk/qmk_firmware/blob/master/tmk_core/protocol/report.h) assigns Mission Control to Consumer `0x29F` and Launchpad to `0x2A0`; its [keycode documentation](https://docs.qmk.fm/keycodes_basic) marks these as macOS actions. Both exceed the stock `0x23C` descriptor limit. A native implementation must extend the descriptor and add internal-code dispatch and press/release handling. Merely submitting those HID usage numbers as NIZ configuration bytes will not work. Launchpad behavior on newer macOS versions needs separate testing.

For a current Mac row, Spotlight `0x0C/0x221` and Dictation `0x0C/0xCF` are candidates, not verified macOS actions on this device. Do Not Disturb `0x01/0x9B` is accepted by [Apple's event parser](https://github.com/apple-oss-distributions/IOHIDFamily/blob/main/IOHIDFamily/IOHIDEventDriver.cpp); the stock System Control report only declares `0x81..0x83`, so its native implementation also needs a report extension. Standard usage definitions are in the [USB HID Usage Tables](https://usb.org/sites/default/files/hut1_7.pdf).

Shortcut alternatives need no new HID report: Mission Control can use Control-Up and Spotlight Command-Space, subject to the user's [macOS shortcut settings](https://support.apple.com/en-us/102650). Dictation can use a [user-selected shortcut](https://support.apple.com/en-gb/guide/mac-help/mh40584/26/mac/26). Other system actions can use user-configured shortcuts rather than claiming a universal default.

## Fn and transport limits

Internal code 207 sets/releases the final keyboard-report byte in Mac mode. The Mac keyboard descriptor at `0xCDF0` declares page `0x00FF`, usage 3, matching [Apple's TopCase KeyboardFn definition](https://github.com/apple-oss-distributions/IOHIDFamily/blob/IOHIDFamily-1035.41.2/IOHIDFamily/AppleHIDUsageTables.h). This is distinct from NIZ layer Fn codes 156/166. Apple's parser gates this vendor usage behind `AppleVendorSupported`: stock emission does not establish native Fn/Globe recognition for NIZ USB identity.

The APROM forwards BLE reports to a separate module whose firmware and HID descriptor are outside the recovered image. USB patches do not prove BLE support.

## Implementation boundary

Start by qualifying stock brightness/media on the exact target. A native full-row firmware variant should preserve the stock build, configuration formats, NIZ Fn-layer behavior and existing report layouts; allocate new internal codes only after checking all dispatch paths. Verify generated descriptor limits, actual ARM report emission and releases before testing USB behavior on macOS. BLE and native Fn/Globe remain separate qualification items.

At the initial investigation, the web [firmware tool](../src/firmware.ts) accepted only the pinned stock package. Unrecognized modified packages remain rejected; supporting an experimental variant would be a separate change with its own package identity and validation. This research does not change the allowlist or authorize deployment.

## Implementation follow-up

The user subsequently requested native codes for every function-row action. The independent V1.5.1-F.1 build and exact web package allowlist are now implemented; see [native implementation and qualification limits](../niz-firmware/firmware/MAC_NATIVE.md). The picker now names 207–209 and 222–230 and checks the loaded model/version. Spotlight and Dictation also have first-party [ZSA macOS testing](https://blog.zsa.io/2212-macos-keycodes/) evidence.

Further local inspection established that stock Mac initialization already selects `05AC:0220`, rather than retaining the NIZ USB identity. Installed macOS 27.0 AppleHIDKeyboard metadata matches this identity with TopCase Fn page `0xFF` / usage 3. The new variant preserves that existing identity behavior and emits Apple TopCase illumination usages 9/8 for USB backlight. Actual device enumeration, binding, Fn/Globe and backlight behavior remain unverified. No hardware was accessed.
