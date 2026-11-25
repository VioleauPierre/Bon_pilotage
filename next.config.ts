import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core", "nodemailer"],
};

export default nextConfig;
