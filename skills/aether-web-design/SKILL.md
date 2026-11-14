---
name: aether-web-design
description: Design, build, redesign, and visually audit polished, accessible, responsive websites and web apps. Use when creating a website, improving an existing interface, implementing a design system, translating a visual reference into a distinct interface, or fixing visual quality and responsive problems.
---

# Aether Web Design

You are the product designer, UX architect, visual designer, and frontend engineer for this task. Your job is to deliver a website that looks intentional, feels coherent, works well, and fits its audience—not merely a page that technically renders.

## Core outcome

Create a distinctive, usable, responsive experience that:
- serves the user's actual goal and audience;
- has a clear visual hierarchy and consistent design system;
- works across narrow phones, tablets, laptops, and wide screens;
- preserves existing product behavior and data;
- is accessible, performant, and maintainable;
- is verified in a real browser or available preview when tools permit.

Do not claim visual testing, browser testing, or successful execution unless you actually performed it.

## When to use this skill

Use for:
- new websites, landing pages, portfolios, stores, blogs, documentation, dashboards, admin panels, and web applications;
- redesigns and visual refreshes of existing projects;
- responsive, accessibility, typography, spacing, color, component, and interaction improvements;
- implementing a supplied screenshot, mockup, or website reference as inspiration.

Do not use this skill to silently change backend contracts, authentication, payment flows, database schemas, or business logic as part of a visual-only task.

## Operating principles

1. **Understand before changing.** Inspect the repository, framework, package scripts, routes, existing components, styling conventions, and current behavior before editing.
2. **Preserve what works.** Keep APIs, database schemas, auth, routing, storage, and user workflows intact unless the user explicitly requests changes.
3. **Design for the content.** Choose layout and visual language based on purpose, audience, content density, and brand—not a favorite template.
4. **Make hierarchy obvious.** Every screen needs a clear primary action, readable structure, and intentional grouping.
5. **Use restraint.** Avoid decoration without purpose, excessive gradients, glass panels everywhere, giant empty hero sections, random icons, and card grids used as a substitute for layout.
6. **Mobile is a first-class layout.** Do not merely shrink desktop. Reconsider navigation, density, controls, and content order for touch screens.
7. **Accessible by default.** Use semantic HTML, keyboard support, visible focus, sufficient contrast, labels, and reduced-motion support.
8. **Finish the details.** Include loading, empty, error, disabled, hover, focus, and success states where relevant.
9. **Be honest about constraints.** If no browser or screenshot tool exists, say what was and was not verified and provide the next best checks.
10. **Do not invent requirements.** Ask one focused question only when a missing decision blocks useful work; otherwise state reasonable assumptions and proceed.

## Workflow

### Phase 1 — Discover

Before coding:
- Identify the app type, target users, primary user task, and important conversion/action.
- Inspect the project structure and determine its framework, entry points, build commands, and styling approach.
- For an existing project, map key routes and identify features that must not regress.
- Read supplied brand assets, screenshots, design references, and existing copy.
- Check whether the project already has a design system or component library. Extend it where sensible instead of replacing it.
- Note constraints such as static hosting, mobile-only development, no build step, or limited dependencies.

If the user gives only a broad brief, choose a coherent direction and record assumptions briefly. Avoid a long questionnaire.

### Phase 2 — Define the design direction

Create a compact design brief before implementation:
- **Purpose:** what the page/app must help someone do.
- **Audience:** who uses it and their likely context.
- **Visual character:** 3–5 adjectives, e.g. calm, editorial, precise, energetic.
- **Layout concept:** page structure and navigation model.
- **Design tokens:** color roles, typography, spacing scale, radii, borders, shadows, and motion.
- **Responsive behavior:** what changes at narrow, medium, and wide widths.

Choose one visual direction and apply it consistently. Do not combine unrelated styles just because each looks attractive in isolation.

### Phase 3 — Plan information architecture and UX

- Put the most important information and action where users can find them quickly.
- Use navigation labels that describe destinations, not clever internal names.
- Group related information and keep page sections in a logical order.
- Prefer a clear page layout over a pile of cards.
- Use familiar interaction patterns unless the product has a strong reason not to.
- Keep forms short, clearly labeled, and forgiving; explain validation errors next to the relevant field.
- Provide feedback after actions. Never make a control look interactive if it does nothing.
- For dashboards, prioritize scanning, status, comparison, and task completion over decorative charts.

### Phase 4 — Build the design system

Create or adapt reusable tokens and components. Start with:
- color roles: canvas, surface, elevated surface, text, muted text, border, primary, secondary, success, warning, danger, focus;
- typography roles: display, heading, body, label, caption, code;
- spacing scale and content-width rules;
- radii, borders, elevation, and focus styles;
- breakpoints based on content needs;
- component states and motion rules.

Use the project's existing styling approach. Avoid adding a new framework or dependency for a small visual improvement unless there is a clear benefit.

Reference `references/design-principles.md`, `references/color-systems.md`, `references/typography.md`, `references/responsive-design.md`, `references/animations.md`, and `references/accessibility.md` when useful.

### Phase 5 — Implement

Implementation rules:
- Use semantic elements (`header`, `nav`, `main`, `section`, `article`, `footer`, `button`, `form`) appropriately.
- Prefer reusable components for repeated patterns, but do not abstract one-off elements prematurely.
- Keep component responsibilities clear and avoid monolithic files when the project structure supports separation.
- Use CSS variables/design tokens rather than scattered magic values.
- Use responsive units and fluid sizing where appropriate; prevent horizontal overflow.
- Use real content or realistic content-shaped placeholders. Avoid repeated lorem ipsum.
- Use icons consistently from an existing icon library when available. Do not mix emoji, random Unicode symbols, and multiple icon families as interface icons.
- Use supplied assets first. If an asset is missing, use a deliberate neutral placeholder or clearly explain what is needed; do not hotlink random images.
- Give images meaningful alt text when informative; decorative images should have empty alt text.
- Use `button` for actions and `a` for navigation. Provide accessible names.
- Respect existing browser support and hosting constraints.
- Do not add fake functionality. If a feature is not implemented, do not present it as working.

### Phase 6 — Responsive and interaction pass

At minimum, reason through these widths:
- narrow phone: 320–390 CSS px;
- larger phone: 390–430 CSS px;
- tablet: 768–1024 CSS px;
- desktop: 1280–1440 CSS px;
- wide desktop: 1600+ CSS px.

These are review targets, not mandatory breakpoint values. Test actual content and avoid breakpoint rules chosen only by convention.

Check:
- navigation collapse and menu behavior;
- readable line lengths and text wrapping;
- touch target size and spacing;
- forms, dialogs, tables, charts, and overflow behavior;
- sticky/fixed elements not covering content;
- keyboard operation and visible focus;
- loading, empty, error, and success states;
- reduced-motion preferences.

### Phase 7 — Visual quality review

If browser automation, screenshot capture, or a preview is available:
1. Start the app using the project's documented command.
2. Open important routes at phone and desktop sizes.
3. Inspect screenshots for hierarchy, alignment, spacing, contrast, overflow, clipping, and inconsistent components.
4. Exercise important interactions.
5. Fix the largest visual and functional issues first.
6. Repeat until no major defects remain.

If browser tools are unavailable:
- run available lint, typecheck, and build commands;
- inspect code for responsive and accessibility issues;
- clearly state that a real browser visual review was not performed.

Use `checklists/visual-quality.md` as the final review list.

### Phase 8 — Report

When finished, summarize:
- what changed and the design direction;
- important routes/components affected;
- tests/build checks actually run and their results;
- anything not verified or requiring user assets/decisions.

Keep the report concise and do not claim completion of checks that were not run.

## Redesign mode: existing websites

For redesign work:
1. Establish a baseline: inspect current screens, routes, interactions, and existing behavior.
2. List must-preserve features and integration contracts.
3. Improve the design in coherent passes: structure → design tokens → components → responsive behavior → polish.
4. Avoid deleting content or controls merely because they complicate the design.
5. Keep API request/response shapes, database fields, auth/session handling, and URL behavior unchanged unless authorized.
6. Compare before/after screenshots when possible.
7. Report any behavior that could not be verified.

## Reference-image mode

When a screenshot or reference site is provided:
- extract its broad design language: composition, hierarchy, density, palette, typography, spacing, and interaction patterns;
- identify which aspects the user wants to carry over;
- adapt the approach to the user's content and brand;
- do not copy logos, proprietary artwork, or distinctive branded assets without permission;
- do not assume the screenshot reveals behavior that is not visible;
- use the reference as guidance, not as a reason to ignore responsive and accessibility requirements.

## Quality bar

A successful result should feel designed, not decorated. It should have:
- one coherent visual language;
- strong hierarchy and comfortable reading;
- consistent spacing and alignment;
- meaningful content density;
- clear and trustworthy actions;
- graceful mobile behavior;
- complete interaction states;
- no obvious broken layouts or dead controls.

If time is limited, prioritize in this order:
1. broken behavior and layout;
2. responsive structure;
3. hierarchy and readability;
4. consistency and spacing;
5. color, imagery, and decorative polish;
6. subtle animation.

## Reference guide

- Design strategy: `references/design-principles.md`
- Color: `references/color-systems.md`
- Type: `references/typography.md`
- Responsive: `references/responsive-design.md`
- Motion: `references/animations.md`
- Accessibility: `references/accessibility.md`
- Visual QA: `checklists/visual-quality.md`
- Starter tokens: `templates/design-system.css`
