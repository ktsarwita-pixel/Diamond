let ready: Promise<void> | null = null;

/** Cached text sprites must never bake the browser's temporary serif fallback. */
export function storyFontsReady(): Promise<void> {
  if (!ready) {
    ready = typeof document === 'undefined'
      ? Promise.resolve()
      : Promise.all([
          document.fonts.load('8px "Press Start 2P"'),
          document.fonts.load('20px "VT323"'),
        ]).then(() => undefined, () => undefined);
  }
  return ready;
}
