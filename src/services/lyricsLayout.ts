/** Center a lyric within its own scroll viewport, regardless of nested/scrolled ancestors. */
export function lyricScrollTop(
  scrollTop: number,
  viewportTop: number,
  lineTop: number,
  viewportHeight: number,
  lineHeight: number,
  scrollHeight: number,
): number {
  const inset =
    lineHeight >= viewportHeight ? 12 : (viewportHeight - lineHeight) / 2;
  const desired = scrollTop + lineTop - viewportTop - inset;
  return Math.max(
    0,
    Math.min(Math.max(0, scrollHeight - viewportHeight), desired),
  );
}
