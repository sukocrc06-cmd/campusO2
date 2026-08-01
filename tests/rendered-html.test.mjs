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

test("restores the original landing page and keeps the panels empty", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const emptyDashboardSource = pageSource.match(
    /function EmptyDashboard[\s\S]*?function ProfileMenu/,
  )?.[0] ?? "";

  for (const prototypeRecord of [
    "Barış Uysal",
    "Ali İhsan Çetin",
    "19030411049",
    "BUS-202",
    "MIS-800",
    "2,50",
  ]) {
    assert.doesNotMatch(emptyDashboardSource, new RegExp(prototypeRecord, "i"));
  }

  assert.match(pageSource, /Kampüsteki her iş/);
  assert.match(pageSource, /onClick=\{\(\) => onEnter\("student"\)\}/);
  assert.match(pageSource, /onClick=\{\(\) => onEnter\("faculty"\)\}/);
  assert.doesNotMatch(pageSource, /EntryStage|prototype-splash/);
  assert.match(pageSource, /Henüz aktif modül bulunmuyor/);
  assert.match(pageSource, /Kişisel veri bulunmuyor/);
});
