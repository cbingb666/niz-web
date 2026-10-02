# MICRO82 / MICRO84 vendor evidence and validation boundary

Research date: 2026-10-02. This adaptation covers the original **82EC MICRO82** and **84EC MICRO84** families. MICRO82 Pro, MINI84, L84 and other 84-key families are separate and are not covered.

**Neither model has been tested on real hardware for this project.** The evidence below comes from official downloads and static PE inspection. No vendor executable or DLL was executed, no firmware was flashed, and no keyboard was read or written. Test reports are synthetic, not real captures or factory configurations.

## Official sources and original files

The [NiZ download page](https://www.nizkeyboard.com/pages/order) links to separate [Micro82 / Micro82 Pro](https://drive.google.com/drive/folders/1ViXZFQZTuz3AjuqCd634N8vagfUNXd3g) and [Micro84](https://drive.google.com/drive/folders/1YcWUcQ4P56POX4h7plZf3wKeG_nW29wn) folders. The original [82EC Software folder](https://drive.google.com/drive/folders/1M2kOd-e4gNo3FU-jh9dlqEb-lv82EDZI) and [84EC Software folder](https://drive.google.com/drive/folders/106W4xfbITvpnk1Wy2_gJTIn4xEAGWkQI) supply these companion files, preserved without modification in `drivers/MICRO82/` and `drivers/MICRO84/`:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [82EC(XRGB)Ble.exe](https://drive.google.com/file/d/1SaGNrAGlEp7do1sWqqgzKhBYkFG3KMYX/view) | 2,464,768 | `d52ca1dc264d9ce49fd9e4f8846dcc55db14f691a3799c71ac81368f715c36a1` |
| [82EC(XRGB)BleHWI.dll](https://drive.google.com/file/d/1VQgyNLM6g5eYg0aiuxv8eiY-7lnl97o8/view) | 66,560 | `decc23974aa1edacce3f68e9b0f391083ddb1a06903129ecbb49b919316667db` |
| [82EC(XRGB)BleRES.dll](https://drive.google.com/file/d/1F_PW-hkblJ8Vt9rP8REUihBHuZcEduJf/view) | 59,749,888 | `950c1b8278acbe47399c06de29779b2d7db616c2fc230af5d0578f8e94394532` |
| [84EC(XRGB)Ble.exe](https://drive.google.com/file/d/1aXt0rT9GQlNqoVbxD0kjOzSRzbWHcsXw/view) | 2,465,280 | `cdde6388e044c212ccc07c983269e017c915dc7355381b61e8c749156d90dae3` |
| [84EC(XRGB)BleHWI.dll](https://drive.google.com/file/d/1EcejZaVKIKO7iYT1MV_uN1DloR8QEGSq/view) | 65,536 | `e8d0bd79d9468ac56106b8801509fcce59cfa05f7dafe2e0e0376d96c5a3ad25` |
| [84EC(XRGB)BleRES.dll](https://drive.google.com/file/d/1BhIbsj_165EIpOuq7lhGJFZcaJAMAeJL/view) | 52,477,440 | `b9d3af403ba3d43134d6c755936a7406ddfde0fcd77a9174d01a161d185e9e4d` |

The 82EC interface strings identify programming software 1.2.3; 84EC identifies 1.1.4. Both executable PE timestamps are 2022-08-17; their HWI and resource DLL timestamps are 2022-06-23. These are build metadata, not proof of release dates. The resource files were checked as valid PE resources. Vendor files retain their owners' copyright, are outside the code's MIT license, and are not runtime resources or build output.

## Identity and protocol

Both HWI DLLs name VID `0483` at virtual address `0x1000D3F8` and identify the Windows configuration interface through `mi_01` at `0x1000D428`. Their PID strings are at `0x1000D3EC`, `0x1000D434`, `0x1000D440` and, for 82EC only, `0x1000D44C`:

| Model | Product IDs | Firmware families accepted |
| --- | --- | --- |
| MICRO82 | `502F`, `512F`, `522F`, `532F` | `82EC(S)`, `82EC(S)BLe`, `82EC(XRGB)`, `82EC(XRGB)BLe` |
| MICRO84 | `5029`, `5129`, `5229` | `84EC(S)`, `84EC(S)BLe`, `84EC(XRGB)BLe` |

The executable firmware-selection messages explicitly name these families. Matching requires a complete family and the `;` separator; Bluetooth capitalization also accepts `Ble`, as in legacy file roots. The inspected 84EC client has three device types and does not establish a wired `84EC(XRGB)` family. A USB ID alone does not identify a model.

**Descriptor inference:** `usagePage: 0x8C, usage: 1` is inferred from the existing NIZ EC configuration interface. These Windows DLLs use `mi_01`; they do not establish a live WebHID usage descriptor. The app additionally requires the actual device to expose 64-byte input and output reports with Report ID `0`. USB permissions, descriptor compatibility and live firmware replies remain unverified.

Both DLLs use a 65-byte Windows output buffer containing Report ID zero plus a 64-byte payload. Static inspection confirms the existing NIZ EC structure:

| Operation | Evidence in each HWI DLL |
| --- | --- |
| Firmware query `F9` | Command byte at `0x10002478` |
| Read keys `F2` | Command at `0x1000150B`; `F6` end and `F0` key-record checks at `0x10001570` / `0x1000157A` |
| Write keys `F1` | Command at `0x1000188C`; terminator construction at `0x10001A25` |
| Group/key addressing | One-based group and key bytes; model-specific multiplication at `0x10001594` |
| RGB | `E1` begins writes, `E0` carries colors, `E2` requests reads, `E6` ends the stream; write paths near `0x10002096`–`0x10002127` |
| Counters | `E3` at `0x10001B97`; copies 82 / 84 unsigned 32-bit values at `0x100023FB` |
| Macros | Existing record types, 11-byte header, 53-byte continuation payload and `C8` delay marker with two delay bytes |

82EC allocates `0x3D8 = 82 × 3 × 4` bytes for key-record pointers at `0x10001450`; 84EC allocates `0x3F0 = 84 × 3 × 4`. The write loops visit 82 / 84 keys at `0x100019F9` and stop after `0xF6 = 246` / `0xFC = 252` records at `0x10001A15`. RGB lengths are `246` / `252` bytes; counter lengths are `328` / `336` bytes. These values are independent of USB model identification. Unknown configuration group counts are rejected rather than extrapolated from another model.

## Physical IDs and layers

The main-keyboard initializers use a key-entry stride of `0x54`. The first and last ID assignments are `0x00440208` / `0x004459DE` in 82EC and `0x004404FE` / `0x00445EFE` in 84EC. Captions and rectangle coordinates establish this order:

| IDs | Captions from left to right |
| --- | --- |
| 1–14 | Esc, F1–F12, Del |
| 15–29 | ~, 1–0, -, +, BackSpace, Home |
| 30–44 | Tab, Q, W, E, R, T, Y, U, I, O, P, [, ], \\, PgUp |
| 45–58 | Caps Lock, A, S, D, F, G, H, J, K, L, ;, ', Enter, PgDown |
| 59–72 | Shift, Z, X, C, V, B, N, M, <, >, ?, Shift, Up, End |
| MICRO82 73–82 | Ctrl, LWin, LAlt, Space, RAlt, Fn, RCtrl, Left, Down, Right |
| MICRO84 73–84 | Ctrl, LWin, LAlt, LFn, Space, RFn, RAlt, App, RCtrl, Left, Down, Right |

For example, 82EC's spacebar is ID 76 with rectangle `(399, 408)`–`(665, 452)`. 84EC's spacebar is ID 77, `(422, 408)`–`(621, 452)`, with Left Fn at ID 76 and Right Fn at ID 78. The web layout normalizes the client rectangles to key units and retains function-group gaps; these display widths are not hardware measurements. Labels use the existing keycap conventions, such as `=` for the client's `+` and arrows for navigation keys.

The clients define Right Fn as `156` and Left Fn as `166`, and require Fn assignments across all three levels. This agrees with the existing Normal / Right Fn / Left Fn protocol layers. Offline demo mappings are illustrative; the client captions and coordinates do not certify the user's factory configuration or printed legends.

## Windows .pro and excluded families

82EC selects roots `82EC(S)Ble`, `82EC(S)`, `82EC(XRGB)` and `82EC(XRGB)Ble`; 84EC selects `84EC(S)Ble`, `84EC(S)` and `84EC(XRGB)Ble`. Their save paths iterate key IDs 1–82 / 1–84 and levels 0–2: loop bounds at `0x0045258D` / `0x004525AC` in 82EC, and `0x004528ED` / `0x0045290C` in 84EC. `CurrentSettings/KEY`, `Mode`, `HWCode`, `ComboKey` and `BackgroundLightSettings/AREA` match the existing converter. Imports validate model roots, key and layer bounds, duplicates, completeness and RGB length before creating a profile.

The official Micro82 download tree separates a [Pro software folder](https://drive.google.com/drive/folders/1np45mbOkegQBx2nZwUhpbN5uDr06S6m6) containing `82pro.exe`, `82proHWI.dll` and `82proRES.dll`. Those binaries were not used for this adaptation. The production model requires `82EC`, not `82pro`; sharing a product page or key count does not establish compatibility. MINI84 and L84 also have separate official download entries and are not MICRO84.

## Remaining hardware qualification

Obtain an explicitly initiated read-only capture for each model and firmware revision, inspect actual WebHID descriptors, confirm all physical IDs and group counts, and compare the loaded keymap with the hardware. Verify counters, RGB on the corresponding variant, browser persistence, physical key effects, and the backup → write → readback transaction before calling either model hardware-validated. Live transfer timing, interruptions and recovery also remain unverified. No calibration tuples are added for either model.
