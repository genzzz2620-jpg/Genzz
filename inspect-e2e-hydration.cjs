const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => process.stdout.write(`pageerror=${error.stack}\n`));
  page.on('console', (message) => {
    if (message.type() === 'error') process.stdout.write(`console=${message.text()}\n`);
  });
  page.on('requestfailed', (request) => process.stdout.write(`requestfailed=${request.url()}\n`));
  await page.goto('http://localhost:3000/register');
  await page.waitForLoadState('networkidle');
  const result = await page.locator('form').evaluate((form) => ({
    readyState: document.readyState,
    reactProps: Object.keys(form).filter((key) => key.includes('react')),
    scriptCount: [...document.scripts].filter((script) => script.src).length,
  }));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await browser.close();
})().catch((error) => {
  process.stderr.write(error.stack);
  process.exit(1);
});
