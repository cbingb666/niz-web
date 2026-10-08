# Contributing

**English** · [简体中文](CONTRIBUTING.zh-CN.md)

Contributions to bug fixes, documentation, and translations are welcome. For larger interaction changes or support for a new model, open an issue first to describe the problem and the information you have.

## Report a problem

Use the [bug report form](https://github.com/cbingb666/niz-web/issues/new?template=bug-report.yml). Include:

- Keyboard model and firmware version, if known.
- Operating system, browser, and their versions.
- Steps to reproduce, what you expected, and what happened.
- The error shown in the app. For read failures, check **Activity**.

Configuration files and read diagnostics may contain device information. Do not submit private configurations or full read captures. Start with error text and steps to reproduce.

Use the [feature request form](https://github.com/cbingb666/niz-web/issues/new?template=feature-request.yml) for improvements or support for a new model. You can still open a blank issue when neither template fits.

## Development setup

Follow the [README](README.md) to clone and start the project. Use Node.js 24 and pnpm 11.0.1 to match CI. Node.js 22.x from 22.13 onward is also supported; see [package.json](package.json) for the full version range.

The pnpm version is pinned in `package.json`. Use only `pnpm-lock.yaml`; do not create npm, Yarn, or Bun lockfiles. Package manager checks reject unsupported installers, and npm also rejects install and run commands through `devEngines`. CI installs with `pnpm install --frozen-lockfile`.

The development server runs at <http://127.0.0.1:5173>. It serves the page and hot updates; it does not proxy USB. Without a keyboard, click **Offline demo** on the empty Devices page or the connection guide, choose a model on the next page, then click **Start demo** to inspect the interface.

The project uses React, strict TypeScript, Vite, Zustand, and shadcn/ui. See [Architecture and compatibility](docs/architecture.md) for module responsibilities and hardware protocol constraints.

### Firmware submodule

[niz-firmware](https://github.com/cbingb666/niz-firmware) is checked out at `niz-firmware/` as a Git submodule. It contains firmware research and rebuild sources maintained in a separate repository. It is optional for running and building the web app.

To fetch the version recorded by this repository after cloning or pulling:

```sh
git submodule update --init --recursive
```

You can also use `git clone --recurse-submodules https://github.com/cbingb666/niz-web.git` for a new checkout. Follow the submodule's own README (Chinese) for firmware work.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start the local development server |
| `pnpm run typecheck` | Check TypeScript types |
| `pnpm run lint` | Check code and unhandled promises |
| `pnpm test` | Run all tests once |
| `pnpm run test:watch` | Rerun tests as files change |
| `pnpm run build` | Check types and build the standalone page |
| `pnpm run preview` | Preview an existing build |
| `pnpm run check` | Run type checks, lint, tests, and a build |

Run `pnpm run check` before submitting code. For documentation-only changes, check links, commands, and behavior descriptions, then run `git diff --check`.

For mapping-scroll changes, also check browser layout; jsdom does not measure it. With Playwright CLI available and the local server running, use:

```sh
playwright-cli open http://127.0.0.1:5173
playwright-cli run-code --filename=tests/browser/mapping-scroll.js
```

The script opens fresh offline demo tabs and checks option coordinates after repeated assignments and key/layer changes in both languages, at desktop and narrow widths. A successful result reports 28 cases with zero movement. It is separate from `pnpm run check` and does not authorize or write to hardware.

## Calibration

Calibration is available by default in the development server and production builds. Use the normal `pnpm run dev` or `pnpm run build` command; no environment flag is required.

Calibration availability follows the model capability declaration and requires matching 64-byte configuration reports. There is no additional USB ID or exact firmware whitelist for calibration. No firmware is hardware-qualified yet. Connecting only identifies the device; calibration still requires the user to open the tool and confirm **Start calibration**.

See the [user flow and recovery limits](docs/usage.md#key-calibration), [module behavior](docs/architecture.md#calibration), and [implementation plan](docs/calibration-implementation-plan.md). The response deadline is 10 seconds per calibration stage, with a 5-second send limit; these are provisional failure bounds, not measured device timings. FakeHID tests use synthetic responses. Real-device qualification still needs an explicitly initiated hardware session, official-tool traffic comparison, persistence checks, and a tested recovery procedure.

Optional calibration diagnostics stay in memory until explicitly downloaded. They use `niz-calibration-capture`, not the configuration read-capture format. Keep private captures outside the repository and build output. Do not run the existing configuration replay command on calibration traces.

## Make changes

- Reuse components in `src/components/ui/` and theme tokens in `src/styles.css`.
- Update both `src/i18n/zh-CN.ts` and `src/i18n/en.ts` for interface text. Full key names and keycap abbreviations live in `key-names.ts` and `key-labels.ts`.
- English is the default documentation language; Chinese versions use `*.zh-CN.md`. Keep their purpose, steps, and limitations in sync. Issue templates are maintained in English only.
- Give each step one main task. Use short sentences, visible focus, and persistent error messages. Consider dyslexia, ADHD, keyboard navigation, and reduced-motion preferences.
- For behavior fixes, add a test that reproduces the problem. Protocol changes need checks for report round trips, model ownership, backups, and readback verification. Follow the [model extension process](docs/architecture.md#add-a-model) for new hardware.

If you have a private read capture, replay it locally:

```sh
pnpm run replay /absolute/path/to/read-capture.json
```

Keep captures outside the project, Git, and build output. See [vendor software notes (Chinese)](drivers/README.md) for rules on collecting original software.

## Submit a pull request

Describe the problem, the resulting behavior, and the checks you ran. Screenshots can help explain interface changes. For device work, include the model, firmware, and whether you used a real keyboard.

FakeHID and jsdom tests do not replace real browser and hardware validation. Do not describe simulated results as hardware validation. See the [validation history (Chinese)](VALIDATION.md) for completed checks and remaining gaps.

## Build and static hosting

`pnpm run build` creates `dist/index.html` and `dist/_headers`. The HTML contains all runtime scripts, styles, images, and translations, so it can be saved on its own. Publish only `dist/`; keep source code, tests, and `drivers/` out of the hosted site.

`dist/_headers` supplies headers such as `Permissions-Policy: hid=(self)` on hosts that support this format. GitHub Pages does not read this file. The page also includes a CSP `<meta>` tag. Use a standalone HTTPS page that permits WebHID to connect devices; do not disable browser security restrictions.

Keep `base: './'` in `vite.config.ts` so the build works under a repository subpath, at a site root, or as offline HTML. In-app navigation uses hash routes such as `#/connect`, `#/demo`, and `#/demo/atom68`. The pathname stays unchanged, so no SPA routing fallback is required for Pages or standalone HTML.

### GitHub Pages

The [Deploy to GitHub Pages](.github/workflows/deploy-pages.yml) workflow deploys on pushes to `main`. Manual runs on other branches only check and build.

To enable Pages for your fork:

1. Under **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. See [GitHub's setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
2. Push to `main`, or run the workflow manually in Actions and select `main`.
3. Wait for both `build` and `deploy` to succeed, then use the URL from the deployment job.

The workflow uses Node.js 24, `pnpm install --frozen-lockfile`, and `pnpm run check`, then uploads only `dist/`. GitHub provides the token automatically. You do not need a personal access token, committed build output, or a `gh-pages` branch.

Changing the site address requires new device authorization. Local backups do not move to the new address automatically.
