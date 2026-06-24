import type { Browser } from "playwright";

export function resolvePlaywrightBrowsersPath(): void {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return;

  const dockerPath = "/app/.playwright-browsers";
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = dockerPath;
  }
}

export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");

  resolvePlaywrightBrowsersPath();

  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT?.trim();
  if (wsEndpoint) {
    return chromium.connect(wsEndpoint, { timeout: 30_000 });
  }

  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
    ],
  };

  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return chromium.launch(launchOptions);
}

export async function fetchHtmlWithBrowser(url: string): Promise<string | null> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "fr-FR",
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(28_000);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 28_000 });
    await page.waitForTimeout(1500);

    const html = await page.content();
    await context.close();
    return html.length > 900_000 ? html.slice(0, 900_000) : html;
  } catch (err) {
    console.error("[playwright-fetch]", url, err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export function isPlaywrightAvailable(): boolean {
  if (process.env.PLAYWRIGHT_WS_ENDPOINT?.trim()) return true;
  return true; // tenter launch ; échec géré à l'appel
}
