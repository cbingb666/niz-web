# User guide

**English** · [简体中文](usage.zh-CN.md)

[Back to README](../README.md) · [Report a bug](https://github.com/cbingb666/niz-web/issues/new?template=bug-report.yml)

Only ATOM66 is currently supported. USB authorization, reads, writes, and RGB controls have not yet been validated on a real keyboard through the web app. Start by reading, checking, and downloading a backup. See the [validation history (Chinese)](../VALIDATION.md) for details.

## Connect and read

Open [NIZ Web](https://cbingb666.github.io/niz-web/) in its own tab in desktop Chrome or Edge. Connect the keyboard with a USB data cable and close other ATOM66 configuration tools. See [Chrome's WebHID documentation](https://developer.chrome.com/docs/capabilities/hid) for browser requirements.

Click **Connect a device** and follow the four steps:

1. Check the label underneath the keyboard and confirm that the model is supported.
2. Connect the USB data cable.
3. Click **Connect keyboard**, then select the device and grant access in the browser dialog.
4. Click **Next**, then **View devices** to return to the Devices page.

**Connecting does not read the configuration automatically.** Click **Configure device** on the keyboard's card, then confirm **Start reading**. The app reads the configuration and tries to save a local backup. After a successful read, export a JSON copy.

The keyboard is temporarily locked during reads and writes. You cannot type or use other controls in the app until the operation ends. Cancelling the read confirmation sends no configuration read commands.

### Multiple keyboards and disconnection

Each keyboard has its own card, configuration, drafts, and undo history. Connecting another keyboard does not switch the active editor. Cancelling authorization or selecting the same device again keeps existing connections intact.

If the keyboard you are editing disconnects, the app returns to the Devices page and keeps your edits. Choose **Resume editing** to view or export them offline. Save anything you need before closing the page.

Clicking **Disconnect** tries to revoke this site's permission for the device, so you will need to select it again next time. Unplugging the cable or closing the page does not revoke permission. If the browser cannot revoke it, follow the app's instructions to remove device access in site settings.

## Edit keys

Each ATOM66 key shows its Normal, Right Fn, and Left Fn mappings. Click the mapping you want to edit, then choose an action. Search by Chinese or English names, or by abbreviations. Enable **Show key numbers** to see key positions.

| Task | Action |
| --- | --- |
| Assign a key or system action | Click the target action to stage it |
| Set a shortcut | Choose modifiers and a main key, then click **Apply this edit** |
| Set a macro or repeat action | Edit the sequence and parameters, then click **Apply this edit** |
| Restore a key's loaded value | Click **Restore** |
| Review pending changes | Open **View all changes**; click an entry to return to that key |

Shortcut recording starts only when you enable it and stops when the recording area loses focus. You can still choose shortcuts reserved by the operating system with the mouse. Macros can repeat a set number of times, play while held, or stop on another press. They support a uniform interval or per-step delays.

Unapplied input stays with its key. Switching keys does not apply or discard it. Apply or discard unfinished input before exporting or writing.

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

You can import compatible JSON from the original native port and ATOM66 Windows `.pro` files. Exports contain the full configuration as JSON. Configurations from different models or firmware versions cannot be mixed directly.

ATOM66 supports configurations with three or nine groups. The interface edits only the first three. The other six groups in a nine-group configuration are preserved unchanged. Importing a three-group file after reading a nine-group keyboard also preserves the device's existing extended groups.

Offline demos and imported files do not represent the current keyboard state. To write offline edits, export them first, connect and read the target keyboard, then import the file again.

**Activity** can export read diagnostics for troubleshooting reports. **Read diagnostics are not recovery backups and cannot be imported for writing.** Configurations, counts, and diagnostics are not uploaded automatically. Keep downloaded files safe.

## Language and offline use

Use the control at the top right to switch between Simplified Chinese and English. Switching keeps your input and does not reconnect the keyboard. The app first uses your saved language, then your browser preference, and falls back to Simplified Chinese if neither matches.

Without a keyboard, choose **Offline demo** on the **Connect a device** page. The built `dist/index.html` contains all runtime resources and translations, so it supports offline import, editing, and export. When opening the file directly, USB and backup permissions depend on the browser and have not been validated on real hardware.

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

The app offers vendor function codes; their effect depends on the keyboard model and firmware. Per-key RGB is available only on RGB models. Firmware updates, sensor calibration, global macro recording, and unverified global device settings are outside this version's scope.
