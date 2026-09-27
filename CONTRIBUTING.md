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

Follow the [README](README.md) to clone and start the project. Use Node.js 24 and npm to match CI. Node.js 22.x from 22.13 onward is also supported; see [package.json](package.json) for the full version range.

The development server runs at <http://127.0.0.1:5173>. It serves the page and hot updates; it does not proxy USB. Without a keyboard, choose **Connect a device** → **Offline demo** to inspect the interface.

The project uses React, strict TypeScript, Vite, Zustand, and shadcn/ui. See [Architecture and compatibility](docs/architecture.md) for module responsibilities and hardware protocol constraints.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Check code and unhandled promises |
| `npm test` | Run all tests once |
| `npm run test:watch` | Rerun tests as files change |
| `npm run build` | Check types and build the standalone page |
| `npm run preview` | Preview an existing build |
| `npm run check` | Run type checks, lint, tests, and a build |

Run `npm run check` before submitting code. For documentation-only changes, check links, commands, and behavior descriptions, then run `git diff --check`.

## Make changes

- Reuse components in `src/components/ui/` and theme tokens in `src/styles.css`.
- Update both `src/i18n/zh-CN.ts` and `src/i18n/en.ts` for interface text. Full key names and keycap abbreviations live in `key-names.ts` and `key-labels.ts`.
- English is the default documentation language; Chinese versions use `*.zh-CN.md`. Keep their purpose, steps, and limitations in sync. Issue templates are maintained in English only.
- Give each step one main task. Use short sentences, visible focus, and persistent error messages. Consider dyslexia, ADHD, keyboard navigation, and reduced-motion preferences.
- For behavior fixes, add a test that reproduces the problem. Protocol changes need checks for report round trips, model ownership, backups, and readback verification. Follow the [model extension process](docs/architecture.md#add-a-model) for new hardware.

If you have a private read capture, replay it locally:

```sh
npm run replay -- /absolute/path/to/read-capture.json
```

Keep captures outside the project, Git, and build output. See [vendor software notes (Chinese)](drivers/README.md) for rules on collecting original software.

## Submit a pull request

Describe the problem, the resulting behavior, and the checks you ran. Screenshots can help explain interface changes. For device work, include the model, firmware, and whether you used a real keyboard.

FakeHID and jsdom tests do not replace real browser and hardware validation. Do not describe simulated results as hardware validation. See the [validation history (Chinese)](VALIDATION.md) for completed checks and remaining gaps.

## Build and static hosting

`npm run build` creates `dist/index.html` and `dist/_headers`. The HTML contains all runtime scripts, styles, images, and translations, so it can be saved on its own. Publish only `dist/`; keep source code, tests, and `drivers/` out of the hosted site.

`dist/_headers` supplies headers such as `Permissions-Policy: hid=(self)` on hosts that support this format. GitHub Pages does not read this file. The page also includes a CSP `<meta>` tag. Use a standalone HTTPS page that permits WebHID to connect devices; do not disable browser security restrictions.

Keep `base: './'` in `vite.config.ts` so the build works under a repository subpath, at a site root, or as offline HTML. In-app navigation does not change the URL and needs no SPA routing fallback.

### GitHub Pages

The [Deploy to GitHub Pages](.github/workflows/deploy-pages.yml) workflow deploys on pushes to `main`. Manual runs on other branches only check and build.

To enable Pages for your fork:

1. Under **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. See [GitHub's setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
2. Push to `main`, or run the workflow manually in Actions and select `main`.
3. Wait for both `build` and `deploy` to succeed, then use the URL from the deployment job.

The workflow uses Node.js 24, `npm ci`, and `npm run check`, then uploads only `dist/`. GitHub provides the token automatically. You do not need a personal access token, committed build output, or a `gh-pages` branch.

Changing the site address requires new device authorization. Local backups do not move to the new address automatically.
