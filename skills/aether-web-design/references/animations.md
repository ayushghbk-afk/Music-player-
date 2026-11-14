# Motion and Interaction

## Purposeful motion

Motion should communicate state, hierarchy, continuity, or feedback. It should not delay the task or distract from content.

Good uses:
- subtle hover and pressed feedback;
- menu/dialog transitions;
- progress and loading indicators;
- state changes and expandable content;
- small orientation cues.

Avoid:
- constant decorative movement;
- long intro animations;
- excessive parallax;
- animation that blocks interaction;
- motion that causes layout shifts.

## Implementation

- Prefer transform and opacity for simple transitions.
- Keep durations short and easing consistent.
- Do not animate every element independently.
- Ensure controls respond immediately.
- Use CSS transitions for simple states; use animation libraries only when complexity justifies them.
- Respect `prefers-reduced-motion: reduce`.
- Never communicate important information only through animation.
- Avoid flashing or rapidly repeating effects.
