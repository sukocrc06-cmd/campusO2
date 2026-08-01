import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("keeps panels free of personal prototype records and exposes Vol 1", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  for (const prototypeRecord of [
    "Barış Uysal",
    "Ali İhsan Çetin",
    "19030411049",
  ]) {
    assert.doesNotMatch(pageSource, new RegExp(prototypeRecord, "i"));
  }

  assert.match(pageSource, /QR Kodla Ders Yoklaması/);
  assert.match(pageSource, /Ders grubu oluştur/);
  assert.match(pageSource, /Ders grubuna (kodla )?katıl/);
  assert.match(pageSource, /\/api\/qr/);
  assert.match(pageSource, /attendance=/);
  assert.match(pageSource, /record-attendance/);
  assert.match(pageSource, /Kamerayı aç/);
  assert.doesNotMatch(pageSource, /localStorage\.setItem\(QR_STORAGE_KEY/);
  assert.match(pageSource, /Kişisel veri bulunmuyor/);
});
