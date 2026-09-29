# Calibration implementation plan

**English** · [简体中文](calibration-implementation-plan.zh-CN.md)

Plan date: 2026-09-28. Updated: 2026-09-30. Batches 1–3 are implemented and enabled by default in development and production builds at the user's request; batch 4, real-hardware qualification, remains outstanding. Protocol evidence and file hashes are in the [calibration research](calibration-research.md). Current instructions are in [Contributing](../CONTRIBUTING.md#calibration), and observed validation results belong in [VALIDATION.md (Chinese)](../VALIDATION.md). The sections below describe the current implementation design and acceptance criteria.

## First delivery

Provide the three-step calibration tool for these exact ATOM66 combinations: `66EC-S`, VID/PID `0483:522A`, firmware `66EC(S);V1.4.4;V1.0;`; and `66EC-XRGB`, VID/PID `0483:502A`, firmware `66EC(XRGB)BLe;V1.2.5;V1.0;`. Both are enabled by default; their actual hardware behavior remains unverified. The RGB combination was added on 2026-09-30 from the identity in the user's screenshot, using the same static calibration-client evidence; this does not establish firmware compatibility through hardware testing.

The tool performs released-state calibration, optionally one or more user-requested held-key batches, then unlocking and a manual typing check. It uses the existing configuration interface, subject to descriptor validation. Enter through a secondary **Calibrate keys** action on the device card; keep **Configure device** as the main action. Opening calibration sends no commands, reads no configuration, and does not switch the active editor. No loaded keymap is required to calibrate.

Availability is one shared policy used by both the UI and HID session: exact model identity, VID/PID, firmware and report descriptor. The configured tuples are available without a feature flag in both development and production builds. Evidence status is recorded separately and remains unvalidated. Unsupported firmware gets a short reason instead of an actionable calibration control. Test-only models do not enter the production registry.

Scope excludes calibration export/restore, travel in millimeters, live capacitance, per-key success displays, firmware updates, additional models, and WebMCP calibration actions. The current protocol establishes none of those features. Development, validation, and builds stay local under the [project agreement (Chinese)](../AGENTS.md).

## User flow and copy

| Step | User-facing task and action | Hardware behavior |
| --- | --- | --- |
| 1. Release all keys | “Release all keys. The keyboard will be locked during calibration; use your mouse or trackpad.” Primary: **Start calibration**. Secondary: **Cancel**, focused by default. Add one short notice that configuration backups cannot restore calibration. | After consent and release of the activation key, recheck firmware and descriptor; send `00 D9 00`, then `00 DB 00`; wait for `DA`. |
| 2. Hold the affected keys | “Hold the keys firmly. Release them after the completion message.” Primary: **Calibrate held keys**. While waiting: “Keep holding the keys.” After completion: offer another batch or **Finish and unlock**. | Each deliberate batch sends one `00 DD 00` and waits for `DE`. No key number or mask is sent. Finishing without a pressed batch is allowed after release calibration completes. |
| 3. Test the keyboard | After unlock transmission, offer a small focused local typing area and **Done**. Tell the user to check the affected keys. | Send `00 D9 01` once. The UI distinguishes the completion notification from unlock transmission and the user's observed typing. |

The packet prefixes above are part of a 64-byte payload with Report ID `0` passed separately; remaining bytes are zero. Their evidence and response limitations are in the research note.

**Keyboard activation must not calibrate the confirming key while it is held.** For Enter/Space activation on the start button, prevent immediate dispatch, keep focus stable, and initiate only after the corresponding `keyup`. Track this interaction inside the dialog, not globally. Repeated keydown must not start twice. If that release event is lost, keep the start pending with a pointing-device recovery action or Cancel; do not substitute a timer. The user still has to release all physical keys: DOM events cannot identify which connected keyboard generated an event or prove that every key is released. Verify the behavior in a real browser as well as jsdom.

Use existing AlertDialog/Button primitives, shared tokens, and the static lock illustration. Show one task at a time, short left-aligned instructions, visible focus, and large targets. Preserve content across layout changes. Show no transfer percentage for calibration. Progress is stage text; a received completion report advances the stage.

During a session, keep the background inert and focus inside the wizard, including the interval waiting for the user to hold keys. The wizard's own actions remain usable. While a command is in progress, Escape and backdrop clicks cannot close it. Between completed stages, **Finish and unlock** is the explicit exit; going backward must not rerun release calibration or imply rollback. After failure, release the page lock, retain an actionable error, and retain any unresolved hardware warning on the affected device card.

The typing area is only a local sanity check. Ordinary DOM input cannot establish the source device, Fn calibration, complete physical-key coverage, or sensor accuracy. Do not upload or record the text in calibration diagnostics.

## Runtime model

Use one calibration session at a time, matching the app's current global operation lock. Keep connection data and results specific to the target device. Separate the user-visible step from the execution phase:

| Phase | Allowed transition |
| --- | --- |
| `preparing` | Cancel with no calibration traffic, or start after consent and key release |
| `identifying` | Check the captured target, firmware and descriptor; fail before locking if anything differs |
| `locking` | Mark the device as possibly locked before sending; on settled send proceed to release calibration |
| `calibrating-release` | Only a valid expected `DA` advances to `awaiting-held-keys` |
| `awaiting-held-keys` | Accept one press request, or finish; hold exclusive ownership while waiting |
| `calibrating-press` | Only a valid expected `DE` returns to `awaiting-held-keys` |
| `unlocking` | One bounded cleanup attempt; always settle the session outcome |
| `testing` / `failed` | Hardware ownership is released; keep the result or actionable error available |

Capture an opaque target token before showing confirmation. Internally it binds device ID, `ConfigDevice` object, connection epoch, model and firmware. Revalidate it inside the exclusive operation before the first command. Keep a local run ID for UI callbacks; that ID is not a firmware transaction ID and cannot authenticate delayed device reports.

Track outcomes separately: release completion; number of acknowledged pressed batches; unlock state (`not-needed`, `sent`, `failed`, or `unknown`); and failure reason. Do not turn a missing unlock acknowledgement into `unlocked: true`, or count acknowledged batches as calibrated keys.

Keep unresolved outcomes independently of loaded profiles, with the page-local device ID, name and firmware. A failed device still needs a recovery entry after its connection closes, even if it never had an editor. Do not attach that outcome to another keyboard merely because its VID/PID matches; page-local IDs are not hardware serial numbers.

No automatic retry of `DB` or `DD`. A wrong reply, timeout, disconnect, or target change ends the run and enters cleanup. Since requests contain no transaction ID, a same-opcode late response cannot always be distinguished from a new operation's reply. End a timed-out session instead of immediately starting another on the same uncertain stream. Unexpected duplication observed during hardware validation is a reason to withhold enablement, not loosen the decoder.

Use an injected 10-second response deadline for each calibration stage and retain the existing 5-second send deadline. These are provisional failure bounds, not measured device duration or a completion timer. Hardware captures will refine these deadlines; no deadline expiry advances to success. Time spent waiting for the user between stages has no automatic calibration/finish action.

## Modules and interface

Keep one deep calibration module with a small interface. Callers choose user operations; command order, acknowledgements and cleanup stay in the implementation. Reuse the existing `ConfigDevice` seam and real-device/FakeDevice adapters.

| Files | Responsibility and deliverable |
| --- | --- |
| New `src/calibration.ts` | Framework-independent stages, packet builders/decoder, bounded waits, typed outcomes and user actions. No editor, backup database, or DOM imports. |
| [`src/hid.ts`](../src/hid.ts) | Resolve the target from `connections`, own exclusivity and lifetime, revalidate identity, route input, track actual send settlement, and perform constrained terminal unlocking. |
| [`src/devices/model.ts`](../src/devices/model.ts), [`atom66/model.ts`](../src/devices/atom66/model.ts) | Define exact allowed tuples and their evidence status; availability is available/unsupported. The normal `66EC` model match remains insufficient for this feature. |
| [`src/store/app-store.ts`](../src/store/app-store.ts) | Store the active wizard snapshot, per-device outcome, and message IDs. Actions open, start, calibrate held keys, finish, and close the result. |
| New `src/components/calibration-dialog.tsx`; [`device-manager.tsx`](../src/components/device-manager.tsx), [`app-dialogs.tsx`](../src/components/app-dialogs.tsx), [`src/app.tsx`](../src/app.tsx) | Device entry, the three-step wizard, operation routing, focus/inert handling, and unload warning while a calibration session is active. |
| [`src/i18n/en.ts`](../src/i18n/en.ts), [`zh-CN.ts`](../src/i18n/zh-CN.ts) | Matching strings and parameters; errors and activity records store identifiers. |

Implemented session interface:

```ts
// Target preparation is synchronous and performs no I/O.
const target = session.calibrationTarget(deviceId);

// Called after consent and activation-key release; returns the owned run.
const run = session.beginCalibration(target, onUpdate);
await run.calibrateHeldKeys(); // valid only between completed stages
await run.finish();            // one unlock; repeated finish shares its result
await run.done;                // settles on finish, failure, disconnect or stop
```

`beginCalibration` automatically performs the authorized identification, lock, and release stage. The wizard enables `calibrateHeldKeys` only after release completion; the module independently enforces the same rule. React never receives a generic “send opcode” method.

Do not call `selectDevice` to calibrate a card. It activates a different editor through current store synchronization. Resolve the private connection record directly and use that captured record for the whole run. Calibrating B while editing A must leave A selected and preserve both editors.

One `HIDSession.exclusive` operation spans the entire run, including user waiting. Press/finish actions signal that already-running operation rather than enqueueing another exclusive task, which would deadlock. Reject new read/write/authorization work while calibration owns the session; do not silently queue it to execute after calibration. Startup restoration remains read-free apart from identification and cannot restart calibration.

The generic store `isLocked` guard remains active for other actions, but calibration's own valid actions need their state-specific guard. Add `calibrate` to operation routing and render the calibration wizard before the existing read/write overlay. Extend the unload condition from unsaved edits to unsaved edits **or an active calibration session**; this is a warning, not an unlock mechanism.

## Terminal cleanup

The current [`PacketChannel.send`](../src/hid.ts) races `sendReport()` against a timer and permanently fails the channel when that race fails. Add internal tracking of the actual underlying send promise, independently of the timeout result. Clearing a timer does not cancel the device transfer.

Only the owned calibration cleanup path may attempt a final unlock. It is limited to the original device object/epoch, requires an open connection and no unresolved prior send, accepts only the fixed unlock packet, runs at most once per run, and cannot make the failed channel usable for ordinary traffic. It must work when receive/protocol failure has poisoned a channel but sending is still settled and available. Do not expose a general error-bypassing send method to the UI.

| End condition | Behavior |
| --- | --- |
| Cancel before start, or identification failure before lock | No unlock needed; end without calibration commands |
| Normal finish | Attempt one unlock; record `sent` if transmission resolves, then offer manual testing |
| Wrong reply, response timeout, or settled send rejection after a possible lock | If the same device/epoch is still open and no send is pending, attempt the one terminal unlock; preserve the original failure even if cleanup succeeds |
| Send deadline expires while the underlying send is unresolved | Do not issue a competing unlock or reopen automatically. Record `unknown`, end the run, and retire the affected configuration connection |
| Target disconnects or epoch changes | End promptly without sending to any replacement connection; preserve the error and per-device edits |
| Unlock itself fails or times out | Do not retry; mark `failed` or `unknown`, retire the affected configuration connection, and show the tested manual recovery procedure |
| Controlled application shutdown | Interrupt pending user waits, perform bounded eligible cleanup before closing handles, and settle `run.done`; do not wait behind the session's own exclusive task |

After a protocol/transport failure, retire the failed connection instead of returning its uncertain stream to ordinary configuration use. Close its channel, invalidate only its live hardware baseline, and require explicit reconnection for that device. Suppress automatic restoration of that failed connection until user action. Existing connections and edits for other devices survive.

Forced tab closure or a crash cannot guarantee asynchronous cleanup. A tested manual recovery procedure remains a hardware-qualification requirement; until then, recovery guidance must identify uncertainty and refer to vendor support, not promise that replugging resets the lock. A “try calibration again” button is not recovery.

## Configuration, diagnostics and compatibility

Calibration does not read or reload a key configuration, clear drafts, or consume undo history. Keep `Profile`, JSON/`.pro` compatibility and IndexedDB backup formats intact. A configuration backup is not a calibration snapshot. Existing configuration writes retain their entire baseline → external-change read → backup → write → readback transaction.

Invalidate the target's live write baseline after a calibration-changing command is dispatched, while retaining its loaded editor and drafts. A later configuration write requires the existing explicit reread/import workflow. Once hardware validation establishes unchanged configuration data on a clean completion, a future policy may preserve that baseline. Failed/uncertain runs always invalidate it. Handle inactive target records without accidentally invalidating the editor's active device.

Keep a bounded, opt-in trace for the calibration session: device/firmware/descriptor metadata, monotonic sequence and elapsed time, direction, Report ID, complete report bytes, phase, and send/timeout outcomes. Keep at most 256 report entries and mark truncation. Record send attempts separately from successful sends. Export explicitly to a local file with a separate `niz-calibration-capture` identifier; do not repurpose `atom66-read-capture`, record typed text, or upload anything. Private captures stay outside Git and build output. A browser trace does not replace capture of the official tool's USB traffic.

## Delivery batches and acceptance

| Batch | Concrete result | Acceptance before advancing |
| --- | --- | --- |
| 1. Protocol and simulation | `calibration.ts`, support policy, synthetic calibration replies in a test-specific FakeDevice adapter | Exact 64-byte requests; response validation; no writes on cancellation or unsupported targets; waits do not manufacture progress; no automatic calibration retry |
| 2. Device session and recovery | Device-bound run, full-session exclusivity, terminal cleanup, shutdown/disconnect handling | B can calibrate without selecting B; edits for all devices survive; no nested-exclusive deadlock; every terminal path settles; an unresolved send never overlaps a cleanup send |
| 3. Default calibration feature | Device-card action, accessible bilingual wizard, local trace export and documentation | Mouse/Enter/Space start behavior, stage actions, inert/focus limits, persistent errors and standalone build verified; the configured tuples are available by default, with no automatic calibration |
| 4. Hardware qualification | Official-tool traffic comparison and browser tests on the candidate ATOM66 firmware; recorded recovery and persistence findings | Confirm response framing, timing, command sequence, successful release/pressed calibration, actual typing, mapping preservation, reconnect/power-cycle behavior and controlled failure recovery; only then mark the evidence as validated |

Use `tests/calibration.test.ts`, `tests/calibration-session.test.ts`, and `tests/calibration-page.test.tsx` as the planned test locations. Cover immediate replies emitted before send resolves, delayed/wrong/duplicate replies, stalled and rejected sends, missing `keyup`, repeated button activation, inactive-target unplugging, connection-generation changes, cleanup failure, page-lock release, and retained drafts. Test public behavior through the module interface and existing FakeHID patterns. Extend relevant [HID tests](../tests/hid.test.mjs), [store tests](../tests/app-store.test.ts), and [operation tests](../tests/operation-page.test.tsx) to protect configuration behavior.

While a run is waiting for user input, tests must wait for its phase rather than use the existing `settle(session)` helper, which awaits `session.tail` and would wait for the whole calibration session to end.

Run relevant tests with each batch and `npm run check` before delivery of code changes. Inspect the actual browser layout in Chinese/English at a narrow viewport and 1280 × 800; jsdom is not browser validation. Keep the standalone HTML, script-hash CSP and `connect-src 'none'`. Update English/Chinese usage and architecture docs when implementation changes behavior, and record actual hardware outcomes and remaining gaps in `VALIDATION.md`.

Batches 1–3 have been implemented locally with simulated hardware. Batch 4 still requires an explicitly authorized real-device session and available equipment; no real calibration, persistence, or recovery result is implied. The implementation does not authorize firmware changes, pushing to `main`, or deployment.
