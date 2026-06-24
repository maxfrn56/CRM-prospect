export interface WebsiteScreenshots {
  desktop: { base64: string; mimeType: "image/jpeg" };
  mobile: { base64: string; mimeType: "image/jpeg" };
  capturedAt: string;
}

export interface ScreenshotCaptureError {
  code: "browser_missing" | "timeout" | "navigation" | "screenshot" | "unknown";
  message: string;
}

export type ScreenshotCaptureResult =
  | { ok: true; data: WebsiteScreenshots }
  | { ok: false; error: ScreenshotCaptureError };

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

const BLOCKED_RESOURCE_PATTERNS = [
  /google-analytics/i,
  /googletagmanager/i,
  /doubleclick\.net/i,
  /facebook\.net\/tr/i,
  /hotjar/i,
  /clarity\.ms/i,
  /segment\.(com|io)/i,
  /sentry\.io/i,
];

function visualAuditEnabled(): boolean {
  if (process.env.VISUAL_AUDIT_ENABLED === "false") return false;
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function isVisualAuditEnabled(): boolean {
  return visualAuditEnabled();
}

import { launchBrowser } from "@/lib/browser/playwright-client";

function classifyCaptureError(err: unknown): ScreenshotCaptureError {
  const message = err instanceof Error ? err.message : String(err);

  if (
    /Executable doesn't exist|browserType\.launch|Failed to launch|ENOENT.*chromium/i.test(
      message
    )
  ) {
    return {
      code: "browser_missing",
      message:
        "Chromium indisponible — le déploiement Docker Railway est requis (voir Dockerfile).",
    };
  }

  if (/timeout|Timeout|TIMED_OUT/i.test(message)) {
    return {
      code: "timeout",
      message:
        "Délai dépassé en chargeant la page (site lent, analytics, pas un blocage anti-bot).",
    };
  }

  if (/net::ERR|NS_ERROR|Navigation|ERR_/i.test(message)) {
    return {
      code: "navigation",
      message: `Impossible d'ouvrir la page : ${message.slice(0, 120)}`,
    };
  }

  return {
    code: "unknown",
    message: message.slice(0, 160) || "Erreur de capture inconnue",
  };
}

async function navigatePage(
  page: import("playwright").Page,
  url: string
): Promise<void> {
  const strategies: Array<{
    waitUntil: "load" | "domcontentloaded" | "commit";
    timeout: number;
    settleMs: number;
  }> = [
    { waitUntil: "load", timeout: 28_000, settleMs: 1200 },
    { waitUntil: "domcontentloaded", timeout: 20_000, settleMs: 1800 },
    { waitUntil: "commit", timeout: 15_000, settleMs: 2500 },
  ];

  let lastError: unknown;

  for (const strategy of strategies) {
    try {
      await page.goto(url, {
        waitUntil: strategy.waitUntil,
        timeout: strategy.timeout,
      });
      await page.waitForTimeout(strategy.settleMs);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Navigation impossible");
}

async function launchBrowserForCapture() {
  return launchBrowser();
}

export async function captureWebsiteScreenshots(
  rawUrl: string
): Promise<ScreenshotCaptureResult> {
  if (!visualAuditEnabled()) {
    return {
      ok: false,
      error: { code: "unknown", message: "Audit visuel désactivé" },
    };
  }

  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const browser = await launchBrowserForCapture();

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        locale: "fr-FR",
        ignoreHTTPSErrors: true,
        viewport: DESKTOP,
      });

      const page = await context.newPage();
      page.setDefaultTimeout(30_000);

      await page.route("**/*", (route) => {
        const requestUrl = route.request().url();
        if (BLOCKED_RESOURCE_PATTERNS.some((p) => p.test(requestUrl))) {
          return route.abort();
        }
        return route.continue();
      });

      await navigatePage(page, url);

      const desktopBuffer = await page.screenshot({
        type: "jpeg",
        quality: 58,
        fullPage: false,
        timeout: 15_000,
      });

      await page.setViewportSize(MOBILE);
      await page.waitForTimeout(500);
      const mobileBuffer = await page.screenshot({
        type: "jpeg",
        quality: 58,
        fullPage: false,
        timeout: 15_000,
      });

      await context.close();

      return {
        ok: true,
        data: {
          desktop: {
            base64: desktopBuffer.toString("base64"),
            mimeType: "image/jpeg",
          },
          mobile: {
            base64: mobileBuffer.toString("base64"),
            mimeType: "image/jpeg",
          },
          capturedAt: new Date().toISOString(),
        },
      };
    } finally {
      await browser.close();
    }
  } catch (err) {
    const error = classifyCaptureError(err);
    console.error(
      "[screenshot-capture]",
      url,
      error.code,
      error.message,
      process.env.PLAYWRIGHT_BROWSERS_PATH ?? "no-browsers-path"
    );
    return { ok: false, error };
  }
}

export function screenshotCaptureIssueMessage(
  error: ScreenshotCaptureError
): string {
  switch (error.code) {
    case "browser_missing":
      return error.message;
    case "timeout":
      return `Capture d'écran expirée — ${error.message}`;
    case "navigation":
      return `Capture d'écran impossible — ${error.message}`;
    case "screenshot":
      return `Capture d'écran échouée — ${error.message}`;
    default:
      return `Capture d'écran impossible — ${error.message}`;
  }
}

export function screenshotToDataUrl(shot: {
  base64: string;
  mimeType: "image/jpeg";
}): string {
  return `data:${shot.mimeType};base64,${shot.base64}`;
}
