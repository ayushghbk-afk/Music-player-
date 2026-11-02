import { useCallback, useEffect, useRef, useState } from "react";

async function exitFullscreen() {
  try {
    await document.exitFullscreen?.();
  } catch {
    // The browser may already have exited fullscreen.
  }
}

/** Viewport expansion always works; browser chrome hiding is a best-effort enhancement. */
export function useExpandedPlayer(onClose: () => void) {
  const [expanded, setExpanded] = useState<"visualizer" | "lyrics" | null>(
    null,
  );
  const element = useRef<HTMLElement | null>(null);
  const ownsFullscreen = useRef(false);
  const request = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const collapse = useCallback(async () => {
    ++request.current;
    setExpanded(null);
    const entering = pending.current;
    const leaving =
      ownsFullscreen.current && document.fullscreenElement === element.current
        ? exitFullscreen()
        : undefined;
    ownsFullscreen.current = false;
    // Editors live outside the fullscreen subtree: don't open them until it has exited.
    await leaving;
    await entering;
  }, []);
  const expand = useCallback(
    (view: "visualizer" | "lyrics", target: HTMLElement | null) => {
      setExpanded(view);
      element.current = target;
      const generation = ++request.current;
      if (
        !target ||
        pending.current ||
        document.fullscreenElement ||
        !document.fullscreenEnabled ||
        !target.requestFullscreen
      )
        return;
      try {
        const entering = target
          .requestFullscreen()
          .then(async () => {
            if (generation === request.current)
              ownsFullscreen.current = document.fullscreenElement === target;
            else if (document.fullscreenElement === target)
              await exitFullscreen();
          })
          .catch(() => {}); // Embedded previews and some browsers prohibit this; viewport mode stays available.
        pending.current = entering;
        void entering.then(() => {
          if (pending.current === entering) pending.current = null;
        });
      } catch {
        /* A denied fullscreen request must never prevent the CSS viewport layout. */
      }
    },
    [],
  );
  const close = useCallback(async () => {
    await collapse();
    onClose();
  }, [collapse, onClose]);
  useEffect(() => {
    const changed = () => {
      if (
        ownsFullscreen.current &&
        document.fullscreenElement !== element.current
      ) {
        ownsFullscreen.current = false;
        ++request.current;
        setExpanded(null);
      }
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      ++request.current;
      if (
        ownsFullscreen.current &&
        document.fullscreenElement === element.current
      )
        void exitFullscreen();
    };
  }, []);
  return { expanded, expand, collapse, close };
}
