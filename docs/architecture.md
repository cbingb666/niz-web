# Architecture and compatibility

**English** · [简体中文](architecture.zh-CN.md)

[Back to contributing](../CONTRIBUTING.md) · [Agent instructions (Chinese)](../AGENTS.md)

NIZ Web runs entirely in the browser and accesses the keyboard's USB configuration interface through WebHID. There is no local device proxy, backend service, or cloud configuration storage. The protocol implementation is based on the original DLL, the existing native port, and real read captures. Validation of the web app on real hardware is still incomplete.

## Module map

| Location | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/app.tsx` | App entry point, HID session lifecycle, and page composition |
| `src/components/` | React interface; `ui/` contains local shadcn/ui primitives |
| `src/store/` | Zustand state, actions, device events, and React subscriptions |
| `src/editor.ts` | Framework-independent editing model, differences, and undo history |
| `src/hid.ts` | Device communication, connection state, read baselines, and write protection |
| `src/calibration.ts` | Independent calibration stages, completion validation, outcomes, and bounded diagnostics |
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

`src/devices/atom66/model.ts` defines USB filters, firmware matching, physical layout, editable layers, group counts, Fn rules, count and RGB capabilities, and demo content.

`src/devices/model.ts` defines the interface and derives key counts and editable record ranges from the layout and layers. `src/devices/index.ts` is the only production model registry. It currently registers ATOM66 alone.

Connection first filters USB configuration interfaces, then reads firmware and requires exactly one matching model. Unknown or ambiguous devices do not proceed to read key configurations. A shared USB ID does not establish model identity, and report counts must not be used to guess a model.

`HIDSession` holds the device model; `Profile` holds the configuration model. The editor, layout, arrow-key navigation, confirmation summary, and page tools use the configuration's model. Before loading a configuration, the default is ATOM66.

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

Windows `.pro` support is limited to the ATOM66 formats explicitly recognized in `src/devices/atom66/legacy.ts`. JSON imports and device writes check firmware compatibility; files are not written directly across firmware versions.

ATOM66 supports complete configurations with three or nine groups. V1.4.4 has 594 records across nine groups. The interface edits only the first three; the other six retain their original reports, and readback compares extended groups byte for byte. Merging a three-group file into a previously read nine-group configuration keeps the device's existing extended groups.

## Devices, editing, and writing

The app entry point manages `HIDSession`. React StrictMode does not recreate the connection. Zustand updates the interface through device events, and switching components does not trigger hardware writes.

Communication channels, models, read baselines, and connection generations are isolated per device. Each device also has its own editor, drafts, selection, and undo history. Adding a connection does not switch the active editor, and a previous confirmation cannot authorize a new connection.

Connecting only identifies the device. Key configuration reads require a user action through **Configure device** or **Read configuration again**, followed by confirmation. Cancellation and failure do not trigger repeated reads.

Writing follows this order: validate configuration ownership and baseline, reread the device for external changes, complete the backup transaction, send the configuration, and compare the readback. One user confirmation covers the whole operation. Writes are not atomic at the device level; interruption can leave partial changes. There is no automatic retry or rollback.

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

## Interface implementation

- Theme tokens live in `src/styles.css`; `components.json` defines the `@/` alias. Dialogs reuse existing Dialog / AlertDialog dimensions, corners, spacing, and buttons.
- Devices, the connection guide, and the editor share device naming. Use the device name, adding a page-local number only when names match. Numbers are not persistent identities.
- The top bar contains branding, breadcrumbs, language, help, and GitHub links. The bottom bar groups device, backup, and activity tools on the left, and undo, redo, visible import/export buttons, and writing on the right, in that order. It contains no change summary, status text, or recovery notices. Compact layouts keep each action group together and the file buttons aligned right. Page spacing follows the bar's actual height.
- The keyboard panel leads with key selection and configuration source; it omits the duplicate model name, back button, and protocol record count. Offline editing uses a connection entry in the bottom bar. Import, export, and Restore have visible text labels. Drafts remain visible in the editor and change list; operation errors use the existing dialogs, and Activity retains error details. State and log message identifiers are preserved.
- Keycaps preserve staggered rows and wide-key proportions. Normal mappings appear at the top of the front face, Left Fn below, and Right Fn on the bottom face. Optional numbers appear on the right; the change dot sits at the bottom of the left face.
- Highlight only the current keycap and selected mapping. Count view replaces Right Fn on the bottom face, and navigation skips that hidden layer. If Right Fn was selected, enabling counts moves to Normal on the same key and preserves the draft.
- Keycaps, previews, and the legend use fixed English short names, abbreviations, and symbols. Editing options show localized full names and useful abbreviations. Both are searchable. Long names do not fall back to numeric keycodes.
- `src/lib/keycap-text.ts` uses Pretext to measure the actual font and cache results. Layouts and previews shrink text to keep one line, currently down to 5px, before wrapping. Full names remain available on hover and in the editor.
- On desktop, the right editor sits between the top and bottom bars. Its summary separates position, layer, and current action and shows unapplied/staged state. Contents scroll independently; a long summary can also scroll so it cannot consume the whole pane. Selecting another key resets the content scroll. At 900px and below, editing uses a drawer and closing it returns focus to the selected key.
- A separate left sidebar lists complete differences and unapplied input. Below 1600px it starts collapsed and opens as a drawer; at 1600px and above, the default is three columns. Collapsing it releases the space while keeping a toolbar entry and count.
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
