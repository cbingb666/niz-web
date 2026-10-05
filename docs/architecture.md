# Architecture and compatibility

**English** · [简体中文](architecture.zh-CN.md)

[Back to contributing](../CONTRIBUTING.md) · [Agent instructions (Chinese)](../AGENTS.md)

NIZ Web runs entirely in the browser and accesses the keyboard's USB configuration interface through WebHID. There is no local device proxy, backend service, or cloud configuration storage. The protocol implementation is based on the original DLL, the existing native port, and real read captures. ATOM66 configuration use has been verified on a real keyboard (reported by the user). ATOM68, MICRO82, MICRO84, calibration and firmware flashing still need hardware validation.

## Module map

| Location | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/app.tsx` | App entry point, HID session lifecycle, and page composition |
| `src/routing.ts` | Hash routes, URL normalization, history traversal and navigation protection |
| `src/components/` | React interface; `ui/` contains local shadcn/ui primitives |
| `src/store/` | Zustand state, actions, device events, and React subscriptions |
| `src/editor.ts` | Framework-independent editing model, differences, and undo history |
| `src/hid.ts` | Device communication, connection state, read baselines, and write protection |
| `src/calibration.ts` | Independent calibration stages, completion validation, outcomes, and bounded diagnostics |
| `src/firmware.ts` | Exact firmware-package allowlist, local SHA-256 validation, immutable firmware reports, and flash result types |
| `src/protocol.ts` | NIZ EC report parsing, model ownership, and configuration conversion |
| `src/devices/` | Model definitions and identification registry; `atom66/` includes layout and `.pro` conversion |
| `src/storage.ts` | IndexedDB backup transactions |
| `src/model-tools.ts` | Optional WebMCP page tools |
| `src/i18n/` | Chinese and English text, key names, abbreviations, and language preferences |
| `src/lib/`, `src/types/` | Browser environment, downloads, text measurement, and WebHID types |
| `scripts/` | Standalone build plugin and replay of captures kept outside the project |
| `tests/` | Protocol, state, React interaction, and build output tests |
| `drivers/` | Original vendor software grouped by model, for reference only |

The project root is the only active web source directory. The package, build plugin, and test environment use `niz-web`. Older names listed below remain for compatibility.

## Model identification and configuration ownership

The `model.ts` files in `src/devices/atom66/`, `atom68/`, `micro82/` and `micro84/` define USB filters, firmware matching, physical layout, editable layers, group counts, Fn rules, count and RGB capabilities, and demo content.

`src/devices/model.ts` defines the interface and derives key counts and editable record ranges from the layout and layers. Physical keys may include `gapBefore` in key units; rendering and vertical arrow-key navigation both account for these spaces. `src/devices/index.ts` is the only production model registry. It registers ATOM66, ATOM68, MICRO82 and MICRO84; the last three remain hardware-unverified.

Connection first filters USB configuration interfaces, then reads firmware and requires exactly one matching model. Unknown or ambiguous devices do not proceed to read key configurations. A shared USB ID does not establish model identity, and report counts must not be used to guess a model.

ATOM66's USB filters include `0483:502A/512A/522A/542A`. The `542A` RGB interface is listed in the manufacturer's 2023-06 ATOM66 programming package and was observed on a connected `66EC-RGB`. It still requires the `0x8C/1` configuration collection, 64-byte input and output reports with Report ID `0`, and matching `66EC` firmware. See the [validation record (Chinese)](../VALIDATION.md#2026-10-04atom66-rgb-usb-筛选补齐).

`HIDSession` holds the device model; `Profile` holds the configuration model. The editor, layout, arrow-key navigation, confirmation summary, and page tools use the configuration's model. Before loading a configuration, the default is ATOM66.

The two offline demo entries reuse `src/components/demo-launcher.tsx` to open the `demo` page. `src/components/demo-picker.tsx` presents the production registry's models with local product images and native radio inputs, followed by one Start demo action. The selection and return entry are separate from the editor; selection survives page and language changes. The connection guide remains mounted and hidden during this detour, retaining its step and input until the user returns. Starting a demo loads the selected model after the existing replacement confirmation; cancellation preserves the configuration and drafts. A changed editor, generation, or connection invalidates pending replacement approval. Demo selection and loading send no hardware commands.

Import merging, configuration comparison, and hardware writes all check model ownership. Different models cannot share configurations even when firmware strings and record counts match.

### Add a model

1. Confirm USB identifiers, firmware matching, key order, layout, group counts, and capabilities using official material and real captures from read-only operations.
2. If the device uses the same NIZ EC reports and command format, define it in `src/devices/<model>/model.ts` and add it to `supportedModels`. Derive count and RGB lengths, record addressing, editable ranges, and Fn synchronization from the model definition.
3. If commands, report structure, or keycode meanings differ, implement the protocol and conversion first, then extend protocol selection. `protocol: 'niz-ec'` declares an implemented protocol; adding parameters does not implement a new one.
4. Add report round-trip checks with real captures and validate device behavior before claiming support.

The 68-key, two-layer, four-group device in `tests/model-fixtures.ts` is fictional and unregistered. It only tests whether the structure can accommodate other models.

## Compatible formats

| Data | Format or identifier to preserve |
| --- | --- |
| ATOM66 JSON | `format: 'atom66-macos'`; old files and backups explicitly belong to ATOM66 |
| New-model JSON | `format: 'niz-web'`, `schema: 1`, and a required `model` ID |
| ATOM66 read diagnostics | `atom66-read-capture` |
| New-model read diagnostics | `niz-read-capture`, including `model` |
| Browser backup database | `atom66-web-backups` |
| Language preference | `atom66.locale` |
| Page tools | `atom66_read_status`, `atom66_read_keys`, `atom66_stage_key_edits` |

Windows `.pro` conversion in `src/devices/legacy.ts` uses each model's explicitly recognized roots and geometry. The original `src/devices/atom66/legacy.ts` import path remains available. JSON imports and backups check model ownership. Same-version imports retain the existing full-profile merge behavior.

`prepareImported` in `src/protocol.ts` migrates different-version configurations of the same registered model without a version allowlist. It clones the live baseline and decodes/reencodes only editable definitions, retaining the target version, identity, counters, legacy attachment and every opaque extension byte, even when the source and target group counts differ. Lighting transfers only when both profiles declare per-key RGB. Mac action availability is checked on both versions to avoid reinterpreting old reserved codes; unsupported or unencodable definitions retain the corresponding target records. Skipping a position with an Fn assignment also retains its linked layers, and the final profile must pass Fn/write validation. The result includes skipped positions and reasons for the store's bilingual notice and activity log. Offline imports have no target and retain their original version. File and backup loading guard the originating editor, generation and connection epoch across asynchronous work. Hardware writes still require the current live baseline and exact target firmware, external-change checks, backup completion and readback verification.

ATOM66 supports complete configurations with three or nine groups. V1.4.4 has 594 records across nine groups. The interface edits only the first three; the other six retain their original reports, and readback compares extended groups byte for byte. Merging a three-group file into a previously read nine-group configuration keeps the device's existing extended groups.

ATOM68 uses 68 keys and three editable layers. Its official client reads and writes six groups (408 records), and its `.pro` files also contain six groups. The last three groups retain their original reports. Three-group JSON imports preserve these groups when merged with a six-group device baseline. Identification excludes the distinct ATOM68 Pro USB interfaces. See [official software evidence and remaining hardware checks](atom68-research.md).

MICRO82 and MICRO84 use 82 and 84 keys respectively, with three editable layers and three groups (246 and 252 records) in the inspected official clients and `.pro` files. Their six-row layouts retain the separate function row; MICRO82 has a long spacebar, while MICRO84 has Left Fn, a shorter spacebar, Right Fn and Menu. Each has independent USB and firmware matching, JSON ownership and `.pro` roots. Unknown group counts are rejected. MICRO82 Pro, MINI84 and other 84-key families are excluded, and neither MICRO model enables calibration. See [official software evidence and remaining hardware checks](micro-research.md).

## Devices, editing, and writing

The app entry point manages `HIDSession`. React StrictMode does not recreate the connection. Zustand updates the interface through device events, and switching components does not trigger hardware writes.

Communication channels, models, read baselines, and connection generations are isolated per device. Each device also has its own editor, drafts, selection, and undo history. Adding a connection does not switch the active editor, and a previous confirmation cannot authorize a new connection.

Connecting only identifies the device. Key configuration reads require a user action through **Configure device** or **Read configuration again**, followed by confirmation. Cancellation and failure do not trigger repeated reads.

Configuration writing follows this order: validate configuration ownership and baseline, reread the device for external changes, complete the backup transaction, send the configuration, and compare the readback. One user confirmation covers the whole operation. Writes are not atomic at the device level; interruption can leave partial changes. There is no automatic retry or rollback.

`BackupStore` compares the model, firmware, saved identity, all raw key reports, lighting and legacy attachments. Identity property order, hexadecimal letter case, backup time, reason and counters do not create new configuration versions. Lookup and `put` run in one IndexedDB read/write transaction, reusing the newest matching ID and refreshing the snapshot, timestamp and reason. When the incoming snapshot omits counters, as configuration pre-write checks do, the most recent available counters among matching backups are retained. A reused backup still resolves only after transaction completion; failure still blocks hardware writing. The database remains `atom66-web-backups` version 1. Listing groups older duplicates by the same comparison and returns the newest snapshot; older stored rows and IDs remain available for downloads and in-page firmware results.

The editor retains up to 50 applied operations, including linked Fn edits, batch remaps, and RGB changes. Loading a new configuration or completing a successful write clears this history. Unapplied input stays with its layer and key and does not enter the applied-operation history.

### Progress semantics

| Phase | Progress measurement |
| --- | --- |
| Send key configuration | Successfully sent packets / total packets for this write, including macro continuation packets |
| RGB and key counts | Bytes actually sent or received / bytes required by the current model |
| Readback | Received packets / expected configuration packets; stop showing a ratio if the count exceeds the target |
| Initial read and check before writing | Unknown total; show phase status and a waiting indicator |
| Local backup, device processing, and verification | No transfer percentage; show phase status and a waiting indicator |

Low-level events record actual transfer counts. The interface does not display step numbers or packet details. Counts do not advance while transmission is blocked or after it fails. The page remains locked until the entire operation succeeds or fails.

## Calibration

[Calibration](../CONTRIBUTING.md#calibration) is enabled by default in both development and production builds for the exact tuples declared in the ATOM66 model. Availability is `available` or `unsupported`, based on model identity, VID/PID, firmware and descriptor; it is independent of build mode and environment flags. Model metadata separately retains candidate/validated evidence, and both current entries remain candidates: default availability does not certify hardware behavior. `HIDSession` rechecks the tuple and descriptor when preparing a confirmation target and when beginning the run.

`calibration.ts` owns the release/press sequence, expected `DA`/`DE` replies, user waits and typed outcomes. `HIDSession` resolves a captured connection record without selecting its editor and holds one exclusive operation until finish or failure. Press/finish actions signal that run instead of queueing another exclusive operation. New configuration operations are rejected during calibration. Tokens are single-use and bound to the exact device and connection epoch. There is no automatic calibration on connection, reread, retry, or rollback.

`PacketChannel` tracks the actual send promise separately from its deadline. A private capability permits one terminal unlock on the original open device when no prior send remains unresolved, including after a receive/protocol failure. It cannot reset the failed channel or send arbitrary cleanup commands. Unknown or failed outcomes retire only the target connection and suppress its automatic restoration; other device connections and editors survive. Controlled shutdown interrupts user waits and attempts eligible bounded cleanup before closing handles. Forced closure has no cleanup guarantee.

Calibration invalidates the target's hardware write baseline before a changing command and preserves local editing state. Its snapshots and per-device results are separate from `Profile`. The optional `niz-calibration-capture` trace holds at most 256 observations, marks truncation, distinguishes attempted/sent/rejected/timed-out output and input, and retains complete observed report bytes. It contains no typed test text, is explicitly downloaded, and does not replace existing configuration formats or backups. The current 10-second response deadline is experimental, not measured firmware timing.

The calibration dialog reuses existing UI primitives. It remains interactive only for valid stage actions while the background is inert. Terminal errors release the page operation lock and remain reviewable independently of whether a profile was loaded. WebMCP exposes no calibration action. Hardware qualification remains outstanding; see [research](calibration-research.md) and the [implementation plan](calibration-implementation-plan.md).

## Firmware flashing

`firmware.ts` accepts two exact packages: the 177,576-byte stock 66EC RGB BLE V1.5.1 wrapper and the 179,378-byte experimental Mac V1.5.1-F.1 build. Their separate SHA-256 pins, record totals and target versions are defined in `stockFirmware` and `macNativeFirmware`. See [Mac native implementation](../niz-firmware/firmware/MAC_NATIVE.md) for mappings, software checks and hardware limits. The digest pins all encrypted record contents; the parser additionally checks framing, lengths and the allowlisted record total (3,352 stock; 3,386 Mac). Validated packages have private, copied report storage and cannot be forged by constructing a metadata object. The firmware binary and research sources are not imported into the runtime bundle.

`HIDSession` separately requires model `atom66`, VID/PID `0483:542A`, exact running version `66EC(RGB)BLe;V1.5.1;V1.0;` or `66EC(RGB)BLe;V1.5.1-F.1;V1.0;`, and matching input/output descriptors. It does not inherit eligibility from general ATOM66 configuration support. A single-use target binds confirmation to the original device object and connection epoch. No previously loaded configuration baseline is required. After **Start writing**, the transaction rechecks the running version, automatically reads the full keys, lighting and key counts, completes a durable backup of that freshly read state, invalidates any previous baseline for the target, and sends Report ID 0 / 64-byte `0x3A` records serially. Read or backup failure blocks transmission. The fresh snapshot is used only for backup and does not replace loaded editors, drafts or histories. The store blocks the target's unapplied input. Configuration writes retain their separate baseline and external-change checks.

The receiver exposes error replies `00 3A A0/A1`, but no positive flash completion reply. Unexpected replies and transfer failures stop transmission without retry, rollback or calibration-style unlock cleanup. Timed-out physical sends receive no competing cleanup command or close. Normal restoration excludes the retired original device object. Progress counts only successfully sent records; after EOF it is replaced by an unknown-duration restart phase. The 25 ms packet spacing derives conservatively from the recovered 8 ms EEPROM-page delay and possible page splits; it and the 15-second restart observation deadline are provisional, not measured device guarantees.

After an observed disconnect, version checking uses an explicitly initiated, filtered device picker, queries only `F9`, rejects other devices already connected before flashing, and never resends firmware. Newly enumerated objects cannot be reliably paired by model/version, so the user selects the physical keyboard and the result says **Selected device version checked**, not byte-for-byte flash verification. Without an observed disconnect the outcome stays unconfirmed, even for a same-version reinstall. A late disconnect can enable checking. Results and backup IDs remain reviewable in page memory. No flash operation is exposed through WebMCP.

Static protocol evidence is in `niz-firmware/recovered/PROTOCOL.md` and `niz-firmware/firmware/mac_updater_compatibility.json` (Chinese research repository). No real USB flashing, bootloader APROM write, power-cycle qualification or recovery validation has been performed. See the [user flow](usage.md#firmware-flashing) and [validation history (Chinese)](../VALIDATION.md).

## Interface implementation

`routing.ts` binds browser history to the store at the application entry point, before rendering. Hash routes preserve the original pathname and query, requiring no static-host fallback. Demo selection replaces the current history entry; page changes and opening a model's offline editor add entries. Model IDs come from the production registry. A fresh hardware-editor link without loaded data returns to Devices. History-driven navigation uses the store's existing leave/replace confirmations, restores the prior history cursor on cancellation or while locked, and never authorizes USB or loads a device configuration. The router's own history state records an index, not editor data. For opaque file origins that reject a History API URL argument, it changes only the fragment and tags the entry without supplying a URL. Routing listeners and subscriptions are disposed with the application, independently of React rendering.

- Theme tokens live in `src/styles.css`; `components.json` defines the `@/` alias. Dialogs reuse existing Dialog / AlertDialog dimensions, corners, spacing, and buttons.
- Devices, the connection guide, and the editor share device naming. Use the device name, adding a page-local number only when names match. Numbers are not persistent identities.
- Device cards open the shared **Device details** dialog from an information icon to the left of **Disconnect**. The dialog targets the clicked device without selecting its editor or sending commands. Closing restores focus to its entry; if that device disconnects, the dialog closes and focus returns to the page heading.
- **Disconnect** uses an icon button on cards and in the editor. Both entries use the shared confirmation dialog, name the target device, and focus **Cancel**. Confirmation is bound to the device ID and connection epoch, which are rechecked before revoking permission and inside the queued disconnect. A connection change invalidates the confirmation. Cancellation preserves the connection; either outcome preserves local edits and other devices.
- The top bar contains branding, breadcrumbs, manuals, language, help, and GitHub links. **Manuals** opens the shared dialog with a model picker. Its selection is local to the dialog; it does not select a device or send hardware commands. `src/lib/manuals.ts` records original file links from `drivers/manuals-2023-06.json`; only the links are bundled. Closing returns focus to the top-bar entry. The bottom bar groups device, backup, and activity tools on the left, and undo, redo, visible import/export buttons, and writing on the right, in that order. It contains no change summary, status text, or recovery notices. Compact layouts keep each action group together and the file buttons aligned right. Page spacing follows the bar's actual height.
- The keyboard panel leads with key selection and configuration source; it omits the duplicate model name, back button, and protocol record count. Offline editing uses a connection entry in the bottom bar. Import, export, and Restore have visible text labels. Drafts remain visible in the editor and change list; operation errors use the existing dialogs, and Activity retains error details. State and log message identifiers are preserved.
- Keycaps preserve staggered rows and wide-key proportions. Normal mappings appear at the top of the front face, Left Fn below, and Right Fn on the bottom face. Optional numbers appear on the right; the change dot sits at the bottom of the left face.
- Highlight only the current keycap and selected mapping. Count view replaces Right Fn on the bottom face, and navigation skips that hidden layer. If Right Fn was selected, enabling counts moves to Normal on the same key and preserves the draft.
- Keycaps, previews, and the legend use fixed English short names, abbreviations, and symbols. Editing options show localized full names and useful abbreviations. Both are searchable. Long names do not fall back to numeric keycodes.
- Empty mappings and vendor function code `0` share the **Unassigned** label and “—” keycap symbol in every layer. Displaying them preserves their distinct report encodings; choosing **Unassigned** still assigns code `0`. Historic input names “No action” and “无功能” remain accepted.
- `src/lib/keycap-text.ts` uses Pretext to measure the actual font and cache results. Layouts and previews shrink text to keep one line, currently down to 5px, before wrapping. Full names remain available on hover and in the editor.
- On desktop, the right editor sits between the top and bottom bars. Its summary separates position, layer, and current action and shows unapplied/staged state. The summary uses a stable 212px region, capped at half the pane, and scrolls when longer; toggling staged state does not move the action list. Selecting another key keeps the editing mode and content scroll; returning to a draft restores its saved editor view. At 900px and below, editing uses a drawer and closing it returns focus to the selected key.
- `src/store/mapping-browser.ts` defines browsing state independently of mapping drafts and configuration data. Each device's editing session retains separate quick-action and shortcut picker queries, categories, active results and list scroll, content scroll per editing mode, and six distinct recent action codes. Ordinary keys and system functions share the quick-action view. Recent codes are recorded only after a successful single-action assignment and use the same draft/Fn/firmware guards as the full list; their labels follow the language. Browsing alone does not dirty the configuration or enter undo history. A newly loaded configuration chooses its initial editor from the selected definition. These preferences are page-local and are not exported or persisted.
- Scrolled action lists also retain the first visible action code and its position relative to the pane. A layout effect restores that visual anchor when recent actions wrap, descriptions change, or another mapping opens; an assignment captures it before staging. Numeric scroll alone cannot preserve a visible row when surrounding content changes height. Search/category changes clear the anchor, and native scroll anchoring is disabled in the content pane to avoid two competing corrections. `tests/browser/mapping-scroll.js` checks actual option coordinates after assignments and key/layer changes in desktop and narrow Chromium views; jsdom scroll-property checks do not prove layout stability.
- The editor footer keeps apply/discard controls and edit errors outside the scrolling content. Searches span all categories; clearing search restores the previous filter. Action buttons use one tab stop with arrow-key navigation. Quick assignment refuses to replace an unapplied draft, and incompatible shortcut views disable editing with a **Continue editing** action. Shortcut recording releases Tab for navigation and consumes Escape to cancel without closing the drawer.
- Pending changes use one centered dialog at every screen width, with the heading focused on entry. Changes are grouped by layer and identified by physical keycap labels and positions, with labeled before/after comparisons. Macro timing and playback settings are visible; sequences expand inline. Unapplied input comes first with explicit continue-editing actions. Edit buttons return to the mapping, opening the editor drawer on narrow screens. Available writes open the existing lock confirmation; no commands are sent before confirmation. The header and footer stay visible while the list scrolls. Detailed differences remain available in write confirmation.
- The keyboard scales to available width. The layout fits without horizontal scrolling from 1280 × 800; at 900px and below it retains horizontal scrolling so keys stay usable. After changes, check the actual layout rather than treating breakpoints as evidence of validation.

## Internationalization

Text resources live in `src/i18n/zh-CN.ts` and `src/i18n/en.ts`. Full key names are in `key-names.ts`, and keycap labels are in `key-labels.ts`. Types and tests check that message keys and interpolation parameters match.

The app first uses the saved preference for the current origin, then the browser preference, and finally Simplified Chinese. Language switching still works for the current page when storage is unavailable.

Status and activity entries store message identifiers, so existing entries can change language too. Switching preserves drafts, selection, configuration, and connections. It does not alter JSON, `.pro`, or historical backup data. All translations are inlined in the build.

## Page tools

Hosts with WebMCP support may register three optional tools: query status, read loaded key definitions, and stage batch key edits. They cannot authorize USB or write hardware. `atom66_read_keys` reads the editor's configuration; it does not query the keyboard.

Tool names retain their compatibility prefix, but results report the current editor model, key count, and layer names. Switching models registers the new input ranges. Staging remains subject to unfinished input and operation locks. The user must confirm hardware writes in the page.

## Build and validation boundaries

`scripts/standalone.ts` inlines scripts and styles, computes SHA-256 CSP hashes from the actual script, and places the classic script after the mount node. Vite embeds `src/assets/favicon.ico` as a data URL in the HTML. Production CSP keeps `connect-src 'none'`. Development uses a separate configuration for Vite hot updates.

Output consists of `dist/index.html` and `dist/_headers`, with no CDN or external image dependencies. Keep `base: './'` and publish only `dist/`. See [Contributing](../CONTRIBUTING.md#build-and-static-hosting) for build and Pages workflow details.

FakeHID checks protocols and command order. jsdom checks DOM interactions and startup of the build output. Neither proves real USB behavior, browser permissions, CSP enforcement, or IndexedDB persistence. Replaying a private capture proves parsing and report round trips only for that sample.

[VALIDATION.md (Chinese)](../VALIDATION.md) preserves results from individual rounds of work. Earlier descriptions of automatic reads, dialogs, and layouts may have been superseded. Check them against the current implementation.
