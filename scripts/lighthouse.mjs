// Measures Lighthouse scores for the given paths against a running production server.
//   npm run build && npm start   (in another terminal)
//   npm run audit:lighthouse -- [baseUrl] [path ...]
// Writes a summary to stdout and full JSON reports to lighthouse-reports/ (gitignored).
import { mkdirSync, writeFileSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const [base = "http://localhost:3000", ...rawPaths] = process.argv.slice(2);
const paths = rawPaths.length ? rawPaths : ["/", "/ar"];
const categories = ["performance", "accessibility", "best-practices", "seo"];

mkdirSync("lighthouse-reports", { recursive: true });
const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH,
  chromeFlags: ["--headless=new", "--no-sandbox"],
});

const rows = [];
try {
  for (const formFactor of ["mobile", "desktop"]) {
    for (const path of paths) {
      const result = await lighthouse(
        new URL(path, base).toString(),
        { port: chrome.port, output: "json", onlyCategories: categories, logLevel: "error" },
        formFactor === "desktop"
          ? {
              extends: "lighthouse:default",
              settings: {
                formFactor: "desktop",
                screenEmulation: {
                  mobile: false,
                  width: 1350,
                  height: 940,
                  deviceScaleFactor: 1,
                  disabled: false,
                },
                throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
              },
            }
          : undefined,
      );
      const lhr = result.lhr;
      const name = `${formFactor}${path === "/" ? "_home" : path.replace(/\//g, "_")}`;
      writeFileSync(`lighthouse-reports/${name}.json`, result.report);
      rows.push({
        page: path,
        formFactor,
        ...Object.fromEntries(categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
        LCP: lhr.audits["largest-contentful-paint"]?.displayValue,
        CLS: lhr.audits["cumulative-layout-shift"]?.displayValue,
        TBT: lhr.audits["total-blocking-time"]?.displayValue,
      });
    }
  }
} finally {
  await chrome.kill();
}
console.table(rows);
