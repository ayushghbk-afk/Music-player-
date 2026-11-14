# Color Systems

## Define roles, not isolated colors

Build a palette around semantic roles:
- `canvas`: page background;
- `surface`: primary content surface;
- `surface-raised`: menus, dialogs, elevated panels;
- `text`: primary readable text;
- `text-muted`: secondary information;
- `border`: separators and outlines;
- `primary`: main action and key emphasis;
- `primary-contrast`: text/icon on primary;
- `secondary`: supporting accent;
- `success`, `warning`, `danger`, `info`: status communication;
- `focus`: visible keyboard focus.

## Palette selection

1. Start with the brand or user-provided assets.
2. Select a neutral foundation suited to the content and environment.
3. Choose one primary accent and, only if useful, one supporting accent.
4. Define light and dark themes as intentional systems, not simple color inversion.
5. Check text, icon, border, and control contrast in actual contexts.
6. Reserve semantic colors for their meanings; do not use red/green only as decoration.

## Practical rules

- Use a small, repeatable palette.
- Do not use color as the only way to communicate state.
- Avoid low-contrast muted text on tinted surfaces.
- Ensure hover, active, disabled, selected, and focus states remain distinguishable.
- Test gradients behind every text layer.
- Keep charts readable with labels, patterns, or other non-color distinctions where possible.
- Respect user theme preferences when the project supports them.

## Theme tokens

Use CSS custom properties or the project's equivalent. See `templates/design-system.css` for a neutral starting point. Replace values to fit the project; do not apply the starter palette blindly.
