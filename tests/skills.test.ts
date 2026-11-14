import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");

const EXPECTED_SKILLS = [
  "aether-web-design",
  "aether-audio-dsp",
  "aether-android-media3",
  "aether-cloud-backend",
  "aether-library-lyrics-pwa",
  "aether-testing-and-verification",
];

function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md must start with YAML frontmatter delimited by ---");
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fields[key] = value;
  }
  return fields;
}

test("all expected repository skills exist with valid Agent Skills frontmatter and documentation", () => {
  assert.equal(
    fs.existsSync(path.join(ROOT, "Skill")),
    false,
    "stray empty Skill placeholder file must not exist at repo root",
  );
  assert.ok(fs.existsSync(SKILLS_DIR), "skills/ directory must exist");
  assert.ok(
    fs.existsSync(path.join(SKILLS_DIR, "README.md")),
    "skills/README.md catalog must exist",
  );

  const entries = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  assert.deepEqual(entries, [...EXPECTED_SKILLS].sort());

  const agentsMd = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  const skillsReadme = fs.readFileSync(path.join(SKILLS_DIR, "README.md"), "utf8");

  for (const skillName of EXPECTED_SKILLS) {
    assert.match(skillName, /^[a-z0-9-]+$/);
    assert.ok(skillName.length <= 64);

    const dir = path.join(SKILLS_DIR, skillName);
    const skillMdPath = path.join(dir, "SKILL.md");
    const readmePath = path.join(dir, "README.md");

    assert.ok(fs.existsSync(skillMdPath), `${skillName}/SKILL.md must exist`);
    assert.ok(fs.existsSync(readmePath), `${skillName}/README.md must exist`);

    const content = fs.readFileSync(skillMdPath, "utf8");
    const frontmatter = parseFrontmatter(content);

    assert.equal(
      frontmatter.name,
      skillName,
      `${skillName}/SKILL.md frontmatter name must match folder name`,
    );
    assert.ok(
      frontmatter.description && frontmatter.description.length >= 40,
      `${skillName}/SKILL.md must have a descriptive trigger summary`,
    );
    assert.ok(
      frontmatter.description.length <= 1024,
      `${skillName}/SKILL.md description must stay within 1024 characters`,
    );
    assert.match(
      frontmatter.description,
      /\bUse when\b/i,
      `${skillName}/SKILL.md description should state when to activate the skill`,
    );

    // Every relative path under references/, checklists/, or templates/ cited in SKILL.md must exist
    const citedPaths = [
      ...content.matchAll(/`((?:references|checklists|templates)\/[A-Za-z0-9._/-]+)`/g),
    ].map((m) => m[1]);
    assert.ok(
      citedPaths.length >= 2,
      `${skillName}/SKILL.md should reference supporting files`,
    );
    for (const rel of citedPaths) {
      const target = path.join(dir, rel);
      assert.ok(
        fs.existsSync(target) && fs.statSync(target).size > 50,
        `${skillName}/SKILL.md cites missing or empty file: ${rel}`,
      );
    }

    assert.ok(
      agentsMd.includes(`skills/${skillName}/SKILL.md`),
      `AGENTS.md must link to skills/${skillName}/SKILL.md`,
    );
    assert.ok(
      skillsReadme.includes(`${skillName}/SKILL.md`),
      `skills/README.md must link to ${skillName}/SKILL.md`,
    );
  }
});
