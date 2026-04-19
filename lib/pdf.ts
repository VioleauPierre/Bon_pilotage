import fs from "node:fs";
import path from "node:path";

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
    const explicitBinPath = process.env.CHROMIUM_BIN_PATH;
    if (explicitBinPath && fs.existsSync(explicitBinPath)) {
      return chromium.executablePath(explicitBinPath);
    }

    const vercelBinCandidates = [
      path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin"),
      path.join(process.cwd(), ".next", "node_modules", "@sparticuz"),
      path.join("/var/task", "node_modules", "@sparticuz", "chromium", "bin"),
      path.join("/var/task", ".next", "node_modules", "@sparticuz"),
    ];

    for (const candidate of vercelBinCandidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      if (path.basename(candidate) === "bin") {
        return chromium.executablePath(candidate);
      }

      const hashedPackageDir = fs
        .readdirSync(candidate, { withFileTypes: true })
        .find(
          (entry) =>
            entry.isDirectory() && entry.name.startsWith("chromium-"),
        );

      if (!hashedPackageDir) {
        continue;
      }

      const hashedBinPath = path.join(candidate, hashedPackageDir.name, "bin");
      if (fs.existsSync(hashedBinPath)) {
        return chromium.executablePath(hashedBinPath);
      }
    }

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
