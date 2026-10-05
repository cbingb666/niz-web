/* global document, requestAnimationFrame, location */
async (page) => {
  // Run with playwright-cli run-code --filename=tests/browser/mapping-scroll.js
  // after opening the local development server. Uses fresh offline demo tabs.
  const base = await page.evaluate(() => location.origin);
  const results = [];
  for (const locale of ['en', 'zh-CN']) {
    for (const width of [1440, 390]) {
      const probe = await page.context().newPage();
      try {
        await probe.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await probe.addInitScript(language => localStorage.setItem('atom66.locale', language), locale);
        await probe.goto(`${base}/#/demo/atom66`);
        await probe.locator('.keyboard .key').first().waitFor();
        const narrow = width === 390;
        const selectKey = async (key, layer = 0) => {
          if (narrow && await probe.getByRole('dialog').count())
            await probe.getByRole('button', { name: locale === 'en' ? 'Close' : '关闭', exact: true }).click();
          await probe.locator('.keyboard .key').nth(key).locator(`.key-layer[data-layer="${layer}"]`).click();
        };
        if (narrow) await selectKey(0);
        const content = probe.locator('.inspector-content');
        const settle = () => probe.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const measure = option => option.evaluate(el => ({
          top: el.getBoundingClientRect().top,
          scroll: document.querySelector('.inspector-content').scrollTop,
        }));
        for (const [index, code] of [8, 111, 152, 155, 167, 121, 8].entries()) {
          const option = probe.locator(`[data-action-code="${code}"]`);
          // Explicit user scrolling precedes each assignment; measure only after
          // it settles, so focus scrolling cannot masquerade as the regression.
          await content.evaluate((el, targetCode) => {
            const target = el.querySelector(`[data-action-code="${targetCode}"]`);
            el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - 80;
          }, code);
          await settle();
          const before = await measure(option);
          await option.click();
          await settle();
          const afterEdit = await measure(option);
          await selectKey(index + 1, index % 3);
          await settle();
          const afterSwitch = await measure(option);
          const result = { locale, width, code, before, afterEdit, afterSwitch };
          if (Math.abs(afterEdit.top - before.top) > 1 || Math.abs(afterSwitch.top - afterEdit.top) > 1 ||
              Math.abs(afterSwitch.scroll - afterEdit.scroll) > 1)
            throw new Error(`Mapping list jumped: ${JSON.stringify(result)}`);
          results.push(result);
        }
      } finally {
        await probe.close();
      }
    }
  }
  return { passed: results.length, maxMovement: Math.max(...results.map(result => Math.max(
    Math.abs(result.afterEdit.top - result.before.top), Math.abs(result.afterSwitch.top - result.afterEdit.top),
  ))) };
}
