# Accessibility

Treat accessibility as part of product quality.

## Structure and semantics

- Use landmarks and a logical heading order.
- Use native buttons, links, inputs, selects, and form elements.
- Associate labels with fields.
- Give icon-only controls accessible names.
- Use descriptive link text.
- Provide alt text for informative images and empty alt for decorative images.

## Keyboard and focus

- All functionality must be keyboard reachable.
- Preserve a logical tab order.
- Provide a visible focus indicator.
- Do not remove outlines without a strong replacement.
- Dialogs should manage focus, support Escape when appropriate, and return focus to the trigger.
- Do not rely on hover as the only way to reveal content.

## Contrast and communication

- Check text and essential UI contrast.
- Do not use color alone for errors, selection, or status.
- Provide clear field instructions and actionable error messages.
- Use live announcements for important asynchronous feedback when appropriate.

## Motion and scale

- Respect reduced-motion settings.
- Support zoom and text resizing.
- Avoid fixed-height text containers that clip content.
- Ensure touch controls have adequate size and spacing.

## Practical verification

Use automated accessibility checks where available, but do not treat a clean automated report as proof of accessibility. Manually inspect keyboard use, focus, labels, heading structure, and contrast.
