# Responsive Design

## Think in layouts, not device labels

The content determines when the layout should change. Breakpoints should respond to actual crowding, unreadable line lengths, or interaction problems.

## Narrow screens

- Prioritize the main task and most-used controls.
- Collapse navigation into an accessible menu when necessary.
- Stack columns in a meaningful order.
- Avoid tiny tap targets and tightly packed controls.
- Keep forms single-column unless a paired layout remains clear.
- Use scrollable tables only when a compact alternative is not suitable; make overflow discoverable.
- Avoid fixed-width elements that create horizontal scrolling.
- Keep dialogs within the viewport and allow internal scrolling when needed.

## Medium screens

- Re-evaluate sidebars, two-column layouts, and navigation density.
- Do not leave awkward half-empty columns.
- Check touch interaction even when the viewport resembles a small laptop.

## Wide screens

- Constrain long text and avoid excessively stretched forms.
- Use additional space for useful comparison or context, not just larger gaps.
- Keep visual balance across the page.

## Technical checks

- Set a correct viewport meta tag.
- Use flexible grids, flex layouts, percentages, `minmax()`, and content-aware widths.
- Use `min-width: 0` where flex/grid children need to shrink.
- Check overflow, sticky elements, image cropping, and long strings.
- Test at intermediate widths, not only common preset sizes.
