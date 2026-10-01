# ATOM68 vendor evidence and validation boundary

Research date: 2026-10-01. This report concerns the original **68EC ATOM68** family. The newer **ATOM68 Pro / 68pro** family is separate and is not covered by this adaptation.

**ATOM68 has not been tested on real hardware for this project.** The evidence below comes from official downloads, static inspection, and official product images. No vendor executable or DLL was executed, no firmware was flashed, and no keyboard configuration was read or written during this research.

## Official sources and inspected artifacts

The [NiZ download page](https://www.nizkeyboard.com/pages/order) links “Atom68 or Atom68 pro” to an [official public download folder](https://drive.google.com/drive/folders/1pZXwjJQF72siBn3xtU-_dEqM77dDVuul). That folder separates original EC-S, EC-BLE, EC-BLE RGB, and Pro firmware. Its [original ATOM68 Software folder](https://drive.google.com/drive/folders/1CWGM9N1DIR4i6YdScP-Sr2yV9YhgItqL) contains the three companion files below. They were downloaded without modification; their PE headers all record 2022-08-17, while the executable's interface strings identify the programming software as version 1.1.4. A PE timestamp is build metadata, not proof of a public release date.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [68EC.exe](https://drive.google.com/file/d/1cPy3jgOoLaJmRsQ9GuFwq6NVUfb2p_oc/view) | 2,452,480 | `f35bed0a90c81c63269c0e07838df9368b273732432b3b6b3dd535f51f0fd00c` |
| [68ECHWI.dll](https://drive.google.com/file/d/1VtoqnKWK6fXQ78oE0B7rojPEXXyTt7Ja/view) | 66,560 | `905546b8b380cfa003f538bbb57381a802c0e83fa05297da090305786751ec8a` |
| [68ECRES.dll](https://drive.google.com/file/d/1OI2Thi2Qsq_tvB2-9tXNZ_n7EY2Sj3qB/view) | 62,163,968 | `234e8d495166b1468a6d36ca5565bdf92b211a2004c8768381289b4ddbf4901a` |
| [68EC(XRGB)Ble User Manual.doc](https://drive.google.com/file/d/11srFJ7ifwG7FVLNEgnTI4ac5R22Ycf97/view) | 663,040 | `cc8c2fc186434d7e1c4fa583a6085d726db564fcb9f477d3ad9722646898e760` |

The inspected files and disassembly were initially kept outside the project in `/private/tmp/niz-atom68-research`. The three companion programs and manual are preserved under [`drivers/ATOM68/`](../drivers/ATOM68/) for reproducibility; they are reference material, not application runtime resources. The resource DLL is a valid large PE resource file, not a download-error HTML page.

## Identification and report format

Static inspection of [68ECHWI.dll](https://drive.google.com/file/d/1VtoqnKWK6fXQ78oE0B7rojPEXXyTt7Ja/view) establishes vendor ID `0x0483` and product IDs `0x5032`, `0x5132`, `0x5232`, `0x5332`. Its device discovery code checks the Windows interface-path component `mi_01`, together with the USB identifiers; the strings are at virtual addresses `0x1000D3EC` through `0x1000D44C`. A matching USB ID alone does not establish the keyboard model.

The original [68EC.exe](https://drive.google.com/file/d/1cPy3jgOoLaJmRsQ9GuFwq6NVUfb2p_oc/view) explicitly names four firmware families: `68EC(S)`, `68EC(S)BLe`, `68EC(XRGB)`, and `68EC(XRGB)BLe`. These names also appear in firmware selection checks and the official original-model firmware directories. Firmware matching should require one of these complete families followed by the version separator, rather than accepting an arbitrary string beginning with “68”.

The DLL uses 65-byte Windows output buffers with the leading Report ID byte set to zero, and 64-byte NIZ EC payloads. The inspected paths use the same command and record structures as the existing ATOM66 implementation:

| Operation / field | Static evidence in 68ECHWI.dll |
| --- | --- |
| Firmware query | `F9`, query construction at `0x10002482`–`0x100024A0` |
| Key read | `F2`, construction at `0x10001502`–`0x1000152A` |
| Key write | `F1`, construction at `0x10001886`–`0x100018A5` |
| Key record | `00 F0`, one-based group and key IDs; read indexing at `0x10001584`–`0x100015A9` |
| Configuration end | `F6`; receive check at `0x10001570`, write terminator at `0x10001A20`–`0x10001A46` |
| RGB | `E1` write, `E2` read, `E6` end; 204 color bytes |
| Counters | `E3`, `E6` end; 68 unsigned 32-bit counters |
| Macro records | Types 2–4, 11-byte header and 53-byte continuation payload; `C8` delay marker with two delay bytes |

These are independently inspected format matches, not a claim that the two DLL files are byte-identical. The implementation must retain the separate WebHID Report ID `0`, existing transaction protections, and model-specific record addressing. [Source: official HWI DLL](https://drive.google.com/file/d/1VtoqnKWK6fXQ78oE0B7rojPEXXyTt7Ja/view).

**Descriptor limitation:** the Windows DLL does not inspect a HID usage page through `HidP_GetCaps`; it identifies `mi_01`. Usage page `0x8C`, usage `1` in the web model is an explicit inference from the existing NIZ EC configuration interface, not a directly extracted ATOM68 descriptor. The application therefore still requires the connected device's actual descriptor to expose 64-byte input and output reports with Report ID `0` on that collection. Actual WebHID permission and descriptor behavior remain unverified.

The official 2023 firmware downloads were also inspected as files: [wired V1.4.1](https://drive.google.com/file/d/1tc9FmacMt4HbkZbOz6izJKKZ-JtfEK8X/view), [Bluetooth V1.4.1](https://drive.google.com/file/d/11r0EpOZ8XE4r93SunFVPRQli_QYZ9y2D/view), and [Bluetooth RGB V1.4.1](https://drive.google.com/file/d/1uTnJVAEEbLsWKbVxEcXD9DH2Mxr_HSZc/view), each named with date `20230520`. Their contents are proprietary hexadecimal update records rather than a directly readable firmware memory image; this inspection did not recover a USB descriptor or certify those firmware versions' live responses. No update file was executed or flashed.

## Wire key order, layers, and capabilities

The [manual](https://drive.google.com/file/d/11srFJ7ifwG7FVLNEgnTI4ac5R22Ycf97/view) describes Normal, Left Fn, and Right Fn layers, counters, custom per-key RGB, and two custom programs. The [2022 client](https://drive.google.com/file/d/1cPy3jgOoLaJmRsQ9GuFwq6NVUfb2p_oc/view) main-keyboard initializer at `0x0043E71A`–`0x00442FF4` assigns these physical IDs and positions from left to right. Key entries have a stride of `0x54` bytes; this order was checked against the initializer's rectangle coordinates, not inferred from a product name or a synthetic test model.

| IDs | Vendor client captions, left to right |
| --- | --- |
| 1–15 | Esc, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, -, +, BackSpace, ~ |
| 16–30 | Tab, Q, W, E, R, T, Y, U, I, O, P, [, ], \\, PgUp |
| 31–44 | Caps Lock, A, S, D, F, G, H, J, K, L, ;, ', Enter, PgDown |
| 45–58 | Shift, Z, X, C, V, B, N, M, <, >, ?, Shift, Up, End |
| 59–68 | Ctrl, LWin, LAlt, Space, RAlt, Fn, RCtrl, Left, Down, Right |

In particular, ID 63 has rectangle `(664, 379)`–`(708, 423)` and caption RAlt; ID 64 has rectangle `(708, 379)`–`(752, 423)` and caption Fn. The official product photos show different printed legends for those two positions and the right column. The adaptation follows the inspected client's coordinate-to-ID mapping. **The captions and offline demo mappings do not certify a keyboard's factory configuration.** A real read capture is still needed to check the mapping against the user's hardware revision. [Sources: official client](https://drive.google.com/file/d/1cPy3jgOoLaJmRsQ9GuFwq6NVUfb2p_oc/view), [official product page](https://www.nizkeyboard.com/products/niz-2019-new-atom-68-ec-bluetooth-keyboard-rgb-or-non-rgb).

The HWI DLL stores six groups of 68 records: its allocation is `0x660 = 68 × 6 × 4` bytes at `0x10001450`, and its write loop visits 68 keys per group until `0x198 = 408` records at `0x100019F9`–`0x10001A1A`. Only the first three groups are edited by this web adaptation; the other three must retain their original packets. A three-group offline example is not evidence that every firmware returns only three groups. RGB length is `0xCC = 204` bytes, and the counter export copies `0x44 = 68` 32-bit values. [Source: official HWI DLL](https://drive.google.com/file/d/1VtoqnKWK6fXQ78oE0B7rojPEXXyTt7Ja/view).

The client defines Left Fn as code `166` and Right Fn as code `156`; its function descriptions require the selected Fn assignment in all three layers. These key codes match the existing NIZ EC code meanings. Neither a fixed complete factory keymap nor the behavior of all firmware revisions has been established from the static artifacts. [Source: official client](https://drive.google.com/file/d/1cPy3jgOoLaJmRsQ9GuFwq6NVUfb2p_oc/view).

## Windows .pro and Pro exclusion

The original client uses roots `68EC(S)Ble`, `68EC(S)`, `68EC(XRGB)`, and `68EC(XRGB)Ble`, selected by device type. Its save path writes 408 `CurrentSettings/KEY` entries: key IDs 1–68 and levels 0–5, with the loop bounds at `0x0044CAA2` and `0x0044CABE`. `Mode`, `HWCode`, `ComboKey`, and `BackgroundLightSettings/AREA` use the same field names as the existing legacy converter. Import must retain all six groups while keeping the web editor limited to its three editable layers. Model roots, key bounds, and level bounds must be checked before converting a file. [Source: official client](https://drive.google.com/file/d/1cPy3jgOoLaJmRsQ9GuFwq6NVUfb2p_oc/view).

The [separate Pro Software folder](https://drive.google.com/drive/folders/1WIU4Fw0ZQBJ1a_V1xZ3PNqlgVN7SKcs1) supplies `68pro.exe` and `68proHWI.dll`. Static inspection identifies Pro USB PIDs `0x5432`, `0x5532`, `0x5632`, `0x5732`, and firmware families `68pro(S)`, `68pro(S)BT`, `68pro(RGB)`, `68pro(RGB)BT`. Those identifiers are excluded from original ATOM68 matching. Their presence on the same official product page and download entry does not establish compatibility with the original 68EC client. The Pro files were inspected only in the temporary directory and were not added to the ATOM68 companion package.

## Product image and remaining verification

The [front-view product photo](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/9dd518a6a1f59edc5f8cc4bd763cfca.png?v=1626686411) comes from the [NiZ official product page](https://www.nizkeyboard.com/products/niz-2019-new-atom-68-ec-bluetooth-keyboard-rgb-or-non-rgb), credited to NiZ. Its original 1600 × 1600 PNG has SHA-256 `45d29d3c7297e6a568109460b919efccd398650f589b6c5c566902286bc52cf8`. No open reuse license was identified; preserve vendor attribution and the project's third-party material limitations.

Before claiming ATOM68 hardware validation, check a real device's descriptors and firmware family, obtain a read-only capture, confirm all 68 IDs and six groups, verify counters and RGB on the corresponding variant, and then exercise the existing backup → write → readback transaction. Browser USB permissions, IndexedDB persistence, live transfer timing, physical key effects, interruptions, and write recovery were not tested here. Calibration remains outside this adaptation's evidence; ATOM66 calibration candidates must not be copied to ATOM68.
