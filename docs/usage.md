# User guide

**English** · [简体中文](usage.zh-CN.md)

[Back to README](../README.md) · [Report a bug](https://github.com/cbingb666/niz-web/issues/new?template=bug-report.yml)

ATOM66, ATOM68, MICRO82 and MICRO84 are supported. ATOM66 has been verified on a real keyboard; the other three are based on official software analysis and have not been tested on hardware. Start by reading, checking, and downloading a backup. See the [validation history (Chinese)](../VALIDATION.md) for details.

For built-in shortcuts, Bluetooth pairing and physical layouts, choose your model in the [manufacturer manual index](manuals.md), which links the original English and Chinese documents.

Choose the **Manuals** book icon in the top bar to open the manual picker, then select ATOM66, ATOM68, MICRO82 or MICRO84. Each model lists its variants with Chinese layout and function PDFs and the English or Chinese Word manuals supplied in the archive. PDFs open in a new tab; Word files download for viewing. Choosing a model or opening a manual keeps your current device and edits in place.

The manuals require internet access, including when using the standalone HTML. PDF and Word files may cover different revisions; check the label on your keyboard. Missing languages or formats are not replaced with a different variant’s manual.

## Connect and read

Open [NIZ Web](https://cbingb666.github.io/niz-web/) in its own tab in desktop Chrome or Edge. Connect the keyboard with a USB data cable and close other keyboard configuration tools. See [Chrome's WebHID documentation](https://developer.chrome.com/docs/capabilities/hid) for browser requirements.

Click **Connect a device** and follow the four steps:

1. Check the label underneath the keyboard and confirm that the model is supported.
2. Connect the USB data cable.
3. Click **Connect keyboard**, then select the device and grant access in the browser dialog.
4. Click **Next**, then **View devices** to return to the Devices page.

For ATOM66, use the keyboard's **Win mode** for configuration, including on macOS. Hold either **Fn** key together with **left Alt** for 3 seconds: one indicator flash means Win mode; two flashes mean Mac mode. Wait for the USB connection to return, then open the browser dialog again. See the [ATOM66 manufacturer manuals](manuals.md#atom66). The connection guide includes this reminder under **Having trouble connecting?**.

**Connecting does not read the configuration automatically.** Click **Configure device** on the keyboard's card, then confirm **Start reading**. The app reads the configuration and tries to save a local backup. After a successful read, export a JSON copy.

The keyboard is temporarily locked during reads and writes. You cannot type or use other controls in the app until the operation ends. Cancelling the read confirmation sends no configuration read commands.

### Multiple keyboards and disconnection

Each keyboard has its own card, configuration, drafts, and undo history. Connecting another keyboard does not switch the active editor. Cancelling authorization or selecting the same device again keeps existing connections intact. Device numbers identify keyboards within the current page; they are not hardware serial numbers.

Each card shows whether its configuration has been loaded and whether edits are pending. **Configure device** asks for a read confirmation when needed; with a current loaded configuration, it returns to that device's editor without another read. The **Disconnect** icon is at the upper right of the card, and supported devices offer **Calibrate keys** beside **Configure device**. Click the information icon to its left to open **Device details**, including firmware and USB identifiers. Opening these details sends no device commands and keeps the current editor selected.

If the keyboard you are editing disconnects, the app returns to the Devices page and keeps your edits under **Edits kept in this page**. Choose **Resume editing** to view or export them offline. These sessions are kept only in the current page; save anything you need before closing it.

Clicking **Disconnect** opens a confirmation naming the keyboard, with **Cancel** focused by default. Confirm **Disconnect** to close the connection and try to revoke this site's device permission; you will need to select the keyboard again next time. Cancelling keeps the device connected. A changed connection cancels the old confirmation. Your edits remain in this page. Unplugging the cable or closing the page does not revoke permission. If the browser cannot revoke it, follow the app's instructions to remove device access in site settings.

## Edit keys

Each key shows its Normal, Right Fn, and Left Fn mappings. Click the mapping you want to edit, then choose an action. Search by Chinese or English names, or by abbreviations. Enable **Show key numbers** to see key positions.

Action categories default to **All**. Search covers all categories and shows the result count. **Clear search** returns to the category you were browsing. From the search field, press Down to focus the first result, then use arrow keys to browse and Enter to choose. Escape returns to search; pressing it again clears the query.

The editor summary shows the selected key position, layer, and current action. It also marks unapplied input and locally staged changes. Use **Devices** in the top bar to return to the device list; your edits are kept. **Import** and **Export** are visible buttons on the right of the bottom bar. When editing offline, use the bottom bar to connect a keyboard or choose one that is already connected.

| Task | Action |
| --- | --- |
| Assign a key or system action | Click the target action to stage it |
| Leave a mapping unassigned | Choose **Unassigned**; keycaps show “—” |
| Set a shortcut | Choose modifiers and a main key, then click **Use this shortcut** |
| Set a macro or repeat action | Edit the sequence and parameters, then click **Apply this edit** |
| Restore a key's loaded value | Click **Restore** |
| Review pending changes | Open **View all changes**; click an entry to return to that key |

Shortcut recording starts only when you enable it. Escape cancels, and Tab stops recording while letting you move to the next control. Recording also stops when the button or window loses focus. To include Tab or Escape in a shortcut, choose it from the action list. You can also choose shortcuts reserved by the operating system from the list. Macros can repeat a set number of times, play while held, or stop on another press. They support a uniform interval or per-step delays.

Unapplied input stays with its key and layer when you switch keys, mapping types, language, pages, or devices. If you switch to a picker that cannot edit the current draft, action choices stay disabled until you apply or discard it. **Continue editing** returns to the draft. Apply and discard controls, along with any edit error, stay at the bottom of the editor while its contents scroll. Apply or discard unfinished input before exporting or writing.

Undo and redo retain up to 50 applied operations, including batch edits, linked Fn changes, and lighting changes. Loading a configuration again or completing a successful write clears the history. **Restore** returns to the loaded value; it is not a factory reset.

Assigning or removing Fn updates all three editable layers. At least one Fn key must remain.

### Keyboard navigation and counts

- Arrow keys: select a neighboring key in the current layer.
- `Alt` + Up / Down: switch layers at the current key.
- **Show counts:** display key counts on the bottom face of each keycap, temporarily replacing the Right Fn mapping. Turn it off to edit Right Fn again.

Missing counts appear as “—”, not zero. Normal and Left Fn mappings remain editable while counts are visible.

### Screen brightness on macOS

Search for “screen brightness” to find `Scroll Lock` and `Pause`, which include macOS descriptions for decreasing and increasing screen brightness. See [QMK's keycode reference](https://docs.qmk.fm/keycodes_basic#lock-keys). The separate brightness − / + actions control keyboard lighting.

This compatibility path has not been tested on a real ATOM66 with macOS. External displays must also support system brightness control. See [Apple's keyboard shortcut reference](https://support.apple.com/en-us/102650).

## Review and write

Edits stay in the page until you confirm a write to the keyboard.

1. Click **Review and write**.
2. Check the change count. Expand **Review changes** for details if needed.
3. Confirm **Start writing** and wait for the whole operation to finish.

The app first reads the keyboard to check for changes made by another tool. It writes only after the local backup has been saved, then reads back the result for verification. One confirmation covers the whole process.

Progress describes data transfer in the **current phase**. Initial reads, checks before writing, backups, and waiting phases do not have a known total, so they show no percentage. After transmission ends, readback verification still needs to finish.

An interrupted write may leave partial changes. Unplugging, sleep, or a device error can interrupt it. The app does not retry or roll back automatically. Reconnect, read again, and check the result before deciding whether to restore a backup.

## Backups and recovery

**Download a JSON copy in addition to keeping browser backups.** Local backups belong to the current browser and site address. Clearing site data, browser storage eviction, or changing the address can make them unavailable.

To restore a saved configuration:

1. Connect the target keyboard and confirm a read of its current configuration.
2. Import a saved JSON file or choose a configuration from **Local backups**.
3. Check the imported content, then click **Review and write** and confirm.

You can import compatible JSON from the original native port, plus Windows `.pro` files for ATOM66, ATOM68, MICRO82 and MICRO84. Exports contain the full configuration as JSON. Configurations from different models or firmware versions cannot be mixed directly.

ATOM66 supports configurations with three or nine groups. The interface edits only the first three. The other six groups in a nine-group configuration are preserved unchanged. Importing a three-group file after reading a nine-group keyboard also preserves the device's existing extended groups.

ATOM68's official configuration contains six groups, including its Windows `.pro` files. The editor changes the first three and preserves the other three. A three-group JSON import after reading the keyboard preserves its existing extended groups. ATOM68 Pro is not included in this adaptation.

MICRO82 and MICRO84 use the original 82EC and 84EC software families, with three groups in the inspected official clients and `.pro` files. Their long-spacebar and dual-Fn layouts are separate models. MICRO82 Pro, MINI84 and other 84-key families are not included. These two MICRO models do not offer calibration.

Offline demos and imported files do not represent the current keyboard state. To write offline edits, export them first, connect and read the target keyboard, then import the file again.

**Activity** can export read diagnostics for troubleshooting reports. **Read diagnostics are not recovery backups and cannot be imported for writing.** Configurations, counts, and diagnostics are not uploaded automatically. Keep downloaded files safe.

## Language and offline use

### Page links and browser navigation

Pages use the fragment after `#`, so the same links work under a repository subpath or in the standalone HTML file.

| URL fragment | Page |
| --- | --- |
| `#/devices` | Devices |
| `#/connect` | Connection guide |
| `#/demo` | Demo keyboard selection |
| `#/demo/atom66` | ATOM66 offline editor |
| `#/demo/atom68` | ATOM68 offline editor |
| `#/demo/micro82` | MICRO82 offline editor |
| `#/demo/micro84` | MICRO84 offline editor |
| `#/editor` | The configuration already loaded in this page |

The selection page records the model and return entry in its URL, for example `#/demo?model=atom68&from=connect`. Changing the model updates that entry without adding another history step. Browser Back and Forward keep loaded configurations and unapplied input; leaving an edited workbench asks for confirmation. Cancelling returns to the original URL and preserves the history entries. During read/write confirmations, reads, writes, or calibration, history navigation keeps the current operation locked.

You can reopen a connection or demo selection link. A fresh connection guide starts at the model check and requires the normal button clicks. A model-specific demo link loads its offline example. URLs contain no configurations, drafts or USB permissions: refreshing loses unsaved page data, and an empty `#/editor` returns to Devices. Opening or changing a URL never grants USB access or reads or writes a hardware configuration.

Use the control at the top right to switch between Simplified Chinese and English. Switching keeps your input and does not reconnect the keyboard. The app first uses your saved language, then your browser preference, and falls back to Simplified Chinese if neither matches.

Without a keyboard, click **Offline demo** on the empty Devices page or in the connection guide. On the next page, select a model card and click **Start demo**. Use the back button to return to the entry page; the connection guide keeps its current step. The selected model stays selected when you change pages or languages. Selecting a model keeps your current configuration unchanged; starting a demo asks for confirmation before replacing pending edits or unapplied input. Cancelling keeps both your edits and the selected demo model. Demos do not request USB access or read or write a keyboard.

The built `dist/index.html` contains all runtime resources and translations, so it supports offline import, editing, and export. When opening the file directly, USB and backup permissions depend on the browser and have not been validated on real hardware.

## Key calibration

Calibration is available by default in development and production builds, without an environment flag, for these ATOM66 combinations:

| Device | VID/PID | Exact firmware |
| --- | --- | --- |
| `66EC-S` | `0483:522A` | `66EC(S);V1.4.4;V1.0;` |
| `66EC-XRGB` | `0483:502A` | `66EC(XRGB)BLe;V1.2.5;V1.0;` |

The configuration interface must also match. Other combinations remain unavailable. Calibration on real hardware has not yet been verified, and configuration backups cannot restore calibration data.

On the target device card, choose **Calibrate keys**. This does not select a different editor or read key configurations. Existing edits and drafts remain in the page.

1. Release every key. Optionally enable local diagnostic recording, then choose **Start calibration**. Cancel is focused by default. Use a mouse or trackpad; if starting with Enter/Space, release the activation key before the operation can begin.
2. Wait for release calibration to finish. Hold one or several affected keys firmly and choose **Calibrate held keys**. Keep holding until the completion message, then release. Repeat for another group if needed, or choose **Finish and unlock**. A pressed-key batch is optional.
3. After the unlock command is sent, check the affected keys in the local typing area. Its text is not saved in diagnostics. This is a manual check, not proof that every sensor is calibrated or calibration has been saved permanently.

The page stays locked throughout the hardware session, including time waiting for you to hold keys. During communication, Escape and backdrop clicks cannot close it. Between completed stages, **Finish and unlock** is the exit; it does not undo calibration. There are no automatic calibration retries or rollbacks.

After a calibration-changing command, the target's live write baseline is invalidated. Its loaded configuration, staged edits, drafts and undo history remain. Before a later configuration write, preserve your edits and use the existing explicit reread/import flow. Calibration never reloads the editor automatically.

If the operation fails, the page unlocks and a reviewable error remains on the Devices page even if that device had no loaded configuration. Failed connections do not automatically restore. An unlock command may have been sent without proving that typing resumed; a stalled send or disconnect can leave the outcome unknown. Check the keyboard first, use the vendor tool or contact vendor support if it remains abnormal, then explicitly reconnect and read the configuration. Replugging and closing the tab are not guaranteed recovery procedures. No automatic unlock can be promised after a browser crash or forced tab closure.

When recording was enabled before starting, **Export calibration diagnostics** downloads this run's bounded report trace. It is neither a calibration backup nor a configuration import. No diagnostics are uploaded, and no ordinary typed text is recorded.

## Troubleshooting

### The keyboard does not appear in the browser

Use desktop Chrome or Edge with WebHID support. Check the USB data cable and close other configuration tools. Open the HTTPS page in its own tab and follow the environment notices in the app. Pages embedded in other apps may not have device access.

Browsers without the required WebHID API, such as Safari, can use offline features only. Do not disable browser security restrictions to connect a device.

### A read was cancelled or failed

Click **Configure device** or **Read configuration again** to retry. The app does not repeatedly prompt or read automatically. Keep the error text and export diagnostics from **Activity** if needed.

### Writing is unavailable after reconnecting

The connection has changed. Read the configuration again to confirm the keyboard's current state. If you have pending edits, export them first, read the device, then import the file again.

### A local backup failed

Export your current configuration, then check browser storage space and privacy settings. A local backup must succeed before writing. Downloading a file does not bypass this check.

### Mouse, media, or lighting actions do not work

The app offers vendor function codes; their effect depends on the keyboard model and firmware. Per-key RGB is available only on RGB models. Firmware updates, global macro recording, and unverified global device settings are outside this version's scope. Key calibration is available for the combinations listed above; its real-hardware behavior still needs validation.
