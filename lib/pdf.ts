import fs from "node:fs";

const COMMON_CHROME_PATHS = [
  process.env.CHROME_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

async function resolveExecutablePath(
  chromium: typeof import("@sparticuz/chromium").default,
) {
  if (process.env.VERCEL) {
    return chromium.executablePath();
  }

  for (const path of COMMON_CHROME_PATHS) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  if (process.platform === "linux") {
    return chromium.executablePath();
  }

  throw new Error(
    "Chromium/Chrome introuvable. Renseigne CHROME_EXECUTABLE_PATH pour le développement local.",
  );
}

export async function renderPdfFromHtml(html: string) {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);

  const executablePath = await resolveExecutablePath(chromium);
  const browser = await puppeteer.launch({
    executablePath,
    args: process.env.VERCEL
      ? chromium.args
      : ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: {
      width: 1280,
      height: 1810,
      deviceScaleFactor: 2,
    },
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
