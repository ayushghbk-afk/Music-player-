# Aether Web Design

A portable Agent Skill for SES: a design and frontend engineering playbook for creating, redesigning, and auditing websites of many kinds.

## Contents

- `SKILL.md` — activation metadata, workflow, implementation rules, and quality bar.
- `references/` — focused design guidance for principles, color, typography, responsive layouts, motion, and accessibility.
- `templates/design-system.css` — neutral starter tokens and baseline styles. Adapt it; do not apply blindly.
- `checklists/visual-quality.md` — final visual and engineering review.

## Install in SES

1. Download and extract `aether-web-design.zip`.
2. Copy the entire `aether-web-design` folder into the skills directory that SES scans.
3. If SES follows the common Agent Skills convention, the folder should be discoverable as:
   `.../skills/aether-web-design/SKILL.md`
4. Restart or refresh SES's skill discovery if required.
5. Ask SES to list or activate `aether-web-design`, then test it on a small page.

The exact skills directory depends on how SES implements skill loading. If SES has a documented custom skills path, use that path instead. Keep the folder name and `SKILL.md` together so relative references continue to work.

## Suggested smoke test

Ask SES:

> Use the Aether Web Design skill. Inspect this project before editing. Improve the home page into a distinctive, responsive interface while preserving all existing routes, API contracts, authentication, and functionality. Run the available checks and report exactly what you verified.

Then verify that SES:
- reads `SKILL.md` and relevant references;
- inspects the project before editing;
- adapts the design to the actual product;
- preserves existing behavior;
- checks mobile and desktop layouts;
- reports tests honestly.

## Notes

This skill is guidance, not a browser or screenshot tool. SES needs appropriate filesystem, terminal, and browser/preview capabilities to perform implementation and visual verification. The skill tells the agent how to use available tools; it cannot create tools the agent does not have.
