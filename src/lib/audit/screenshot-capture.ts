export interface WebsiteScreenshots {
  desktop: { base64: string; mimeType: "image/jpeg" };
  mobile: { base64: string; mimeType: "image/jpeg" };
  capturedAt: string;
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

function visualAuditEnabled(): boolean {
  if (process.env.VISUAL_AUDIT_ENABLED === "false") return false;
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function isVisualAuditEnabled(): boolean {
  return visualAuditEnabled();
}

export async function captureWebsiteScreenshots(
  rawUrl: string
): Promise<WebsiteScreenshots | null> {
  if (!visualAuditEnabled()) return null;

  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "fr-FR",
        ignoreHTTPSErrors: true,
      });

      const page = await context.newPage();
      page.setDefaultTimeout(20_000);

      await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
      await page.waitForTimeout(800);

      await page.setViewportSize(DESKTOP);
      const desktopBuffer = await page.screenshot({
        type: "jpeg",
        quality: 58,
        fullPage: false,
      });

      await page.setViewportSize(MOBILE);
      await page.waitForTimeout(400);
      const mobileBuffer = await page.screenshot({
        type: "jpeg",
        quality: 58,
        fullPage: false,
      });

      await context.close();

      return {
        desktop: {
          base64: desktopBuffer.toString("base64"),
          mimeType: "image/jpeg",
        },
        mobile: {
          base64: mobileBuffer.toString("base64"),
          mimeType: "image/jpeg",
        },
        capturedAt: new Date().toISOString(),
      };
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

export function screenshotToDataUrl(
  shot: { base64: string; mimeType: "image/jpeg" }
): string {
  return `data:${shot.mimeType};base64,${shot.base64}`;
}
