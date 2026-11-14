# Typography

## Build a type scale

Use a small hierarchy with clear roles:
- display: optional, for a major page statement;
- h1: page title;
- h2/h3: section and subsection titles;
- body: primary reading;
- label: form and control labels;
- caption: supporting metadata;
- code: technical content.

## Selection

- Prefer highly legible fonts with appropriate language coverage.
- Use no more than two font families unless there is a strong editorial reason.
- Load only needed weights and subsets.
- Prefer system fonts when performance, offline support, or simplicity matters.
- Do not rely on font size alone; use weight, spacing, and placement to establish hierarchy.

## Readability

- Keep body text comfortably readable; avoid tiny interface copy.
- Use a reasonable line length for long-form text.
- Set line-height appropriate to the type size and language.
- Avoid long all-caps text.
- Do not use ultra-light weights for important content.
- Ensure headings wrap gracefully on narrow screens.
- Test real content, including long names, translated text, and numbers.

## Responsive type

Use fluid sizing carefully where it helps, for example `clamp()`, with sensible minimum and maximum values. Prevent oversized headings from dominating mobile screens.
