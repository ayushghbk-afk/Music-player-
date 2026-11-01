import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileBottomNav } from "../src/components/MobileBottomNav";

function render(open: boolean, currentView: "songs" | "backup" = "songs") {
  return renderToStaticMarkup(
    React.createElement(MobileBottomNav, {
      currentView,
      onSelectView() {},
      onTriggerImport() {},
      hiResCount: 5,
      totalTrackCount: 5,
      isMoreOpen: open,
      onMoreOpenChange() {},
      onOpenSettings() {},
      theme: "obsidian",
      onSelectTheme() {},
    }),
  );
}
test("mobile navigation has five primary destinations instead of seven crowded tabs", () => {
  const markup = render(false);
  assert.equal((markup.match(/<button/g) || []).length, 5);
  assert.ok(markup.includes('aria-label="More options"'));
  assert.ok(markup.includes('aria-current="page"'));
  assert.ok(!markup.includes('role="dialog"'));
});
test("More sheet preserves secondary features and exposes theme selection accessibly", () => {
  const markup = render(true, "backup");
  for (const label of [
    "Hi-res collection",
    "Sound assistant",
    "Backup &amp; sync",
    "Playback preferences",
    "Bring your music",
  ])
    assert.ok(markup.includes(label), label);
  assert.ok(markup.includes('aria-modal="true"'));
  assert.ok(markup.includes('aria-label="Close more options"'));
  assert.equal((markup.match(/aria-pressed=/g) || []).length, 5);
});
