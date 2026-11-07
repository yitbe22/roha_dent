// The intro screen (#loader in index.html, styles in styles.css) and the hero intro that follows it.
// First visit: public/boot.js adds .show-loader + .hero-intro before paint.
// Logo click / "Back to top": playIntro() replays the lift + white wipe, then the hero intro.

/** When the hero starts appearing on first load (matches --t0 and the #loader timing in styles.css). */
export const INTRO_MS = 2150;
const REPLAY_T0 = '1.15s';
const INTRO_TOTAL_MS = 2150 + 2000;

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let clearTimer: number | undefined;
/** Drop .hero-intro once it has played, so pages opened later appear without the long delay. */
function scheduleIntroEnd(ms: number) {
  window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => {
    const root = document.documentElement;
    root.classList.remove('hero-intro');
    root.style.removeProperty('--t0');
  }, ms);
}

/** Wire the loader once: hide it for good when it finishes, and end the first-load hero intro. */
export function initIntro() {
  const loader = document.getElementById('loader');
  loader?.addEventListener('animationend', (e) => {
    if (e.animationName === 'ld-out') loader.classList.add('done');
  });
  if (document.documentElement.classList.contains('hero-intro')) {
    scheduleIntroEnd(Math.max(0, INTRO_TOTAL_MS - performance.now()));
  }
}

/**
 * Cover the screen with the blue intro, run `swap` (navigate / scroll to top) while it is covered,
 * then lift it away and replay the hero intro.
 */
export function playIntro(swap: () => void) {
  const loader = document.getElementById('loader');
  if (reduced() || !loader) {
    swap();
    window.scrollTo(0, 0);
    return;
  }
  const root = document.documentElement;
  loader.className = '';
  void loader.offsetWidth; // restart the CSS animations
  loader.className = 'replay';
  window.setTimeout(() => {
    swap();
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    root.style.setProperty('--t0', REPLAY_T0);
    root.classList.remove('hero-intro');
    void root.offsetWidth;
    root.classList.add('hero-intro');
    window.dispatchEvent(new Event('roha:intro'));
    scheduleIntroEnd(1150 + 2000);
  }, 60);
}
