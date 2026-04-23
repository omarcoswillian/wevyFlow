import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SERVICE_SECRET || "";

// Block private/internal IPs (SSRF protection)
function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(host)) return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/render", async (req, res) => {
  if (SECRET && req.headers["x-service-secret"] !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { url } = req.body;
  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ error: "URL inválida ou não permitida" });
  }

  let browser = null;
  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9" });

    // load = DOM + subresources. networkidle trava em páginas com analytics/polling.
    await page.goto(url, { waitUntil: "load", timeout: 25000 });

    // Extra wait for JS frameworks to hydrate and lazy content to appear
    await page.waitForTimeout(2000);

    // Inline all external stylesheets so the HTML is self-contained
    await page.evaluate(async () => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
      await Promise.allSettled(
        links.map(async (link) => {
          try {
            const r = await fetch(link.href);
            if (!r.ok) return;
            const css = await r.text();
            const style = document.createElement("style");
            style.setAttribute("data-inlined-from", link.href);
            style.textContent = css;
            link.replaceWith(style);
          } catch {
            // Keep original link if fetch fails
          }
        })
      );
    });

    // Screenshot capped at 5000px height to avoid massive base64 payloads
    const pageHeight = await page.evaluate(() =>
      Math.min(document.documentElement.scrollHeight, 5000)
    );
    const screenshotBuffer = await page.screenshot({
      clip: { x: 0, y: 0, width: 1280, height: pageHeight },
      type: "jpeg",
      quality: 70,
    });
    const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`;

    // Rendered DOM (post-JS execution, with CSS inlined)
    const html = await page.content();
    const title = await page.title();

    console.log(`[render] OK  ${url}  (${Math.round(screenshotBuffer.byteLength / 1024)}KB screenshot)`);

    res.json({ html, screenshot, title });
  } catch (err) {
    console.error(`[render] ERR ${url} — ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Browser service running on :${PORT}`);
});
