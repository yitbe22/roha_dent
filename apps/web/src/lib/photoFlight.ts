/**
 * Photo flight, ported from the Habesha Leather product cards. Clicking a treatment card lifts a
 * copy of its photo above the page; when the treatment page mounts, the copy flies into that
 * page's header photo and hands over to the real image once it has decoded. If the header never
 * shows up, the copy fades away.
 *
 * The flight animates only `transform` (and `opacity` at the end), so it runs on the compositor
 * and stays smooth while the main thread builds the new page.
 */
type Pending = { slug: string; clone: HTMLImageElement; zoom: number; rect: DOMRect; timer: number };
type Box = { left: number; top: number; width: number; height: number };

let pending: Pending | null = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const DURATION = 800;
const STEPS = 30;
// expo-out; applied per keyframe so the WAAPI timing can stay linear
const easeOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Cards load the half-width "-sm" copy (see lib/img.ts); the treatment page shows the full one. */
const largeSrc = (src: string) => src.replace(/-sm\.webp$/, '.webp');

const preloaded = new Set<string>();

/** Start downloading a card's full-size photo so the treatment page has it ready. */
export function preloadLarge(img: HTMLImageElement | null | undefined) {
  if (!img) return;
  const src = largeSrc(img.currentSrc || img.src);
  if (preloaded.has(src)) return;
  preloaded.add(src);
  new Image().src = src;
}

/** Resolves when the image can be shown, or after `ms` at the latest. */
function ready(img: HTMLImageElement | null, ms = 900) {
  if (!img || (img.complete && img.naturalWidth)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, ms);
  });
}

/**
 * A hovered card shows its photo zoomed (group-hover:scale in TreatmentGrid). The copy keeps that
 * zoom, trimmed back to the card's box by a clip-path inset that is scaled along with it. The
 * card rounds only its top corners over the photo.
 */
const clipFor = (zoom: number, radius: number) => {
  const r = radius / zoom;
  return `inset(${((1 - 1 / zoom) / 2) * 100}% round ${r}px ${r}px 0 0)`;
};

/** Called on click. `frame` is the card's photo box. */
export function startFlight(slug: string, frame: HTMLElement | null) {
  cancelFlight();
  const img = frame?.querySelector('img');
  if (!frame || !img || reduced()) return;
  const rect = frame.getBoundingClientRect();
  if (!rect.width || rect.bottom < 0 || rect.top > window.innerHeight) return;
  preloadLarge(img);

  const card = frame.closest('a');
  const zoom = card?.matches(':hover') ? 1.04 : 1;
  const radius = card ? parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0 : 0;
  const clone = document.createElement('img');
  clone.src = img.currentSrc || img.src;
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    objectFit: 'cover',
    transform: `scale(${zoom})`,
    clipPath: clipFor(zoom, radius),
    zIndex: '60',
    pointerEvents: 'none',
  });
  document.body.appendChild(clone);
  pending = { slug, clone, zoom, rect, timer: window.setTimeout(cancelFlight, 4000) };
}

/** Called by the treatment page's header photo when it mounts. Returns true if a flight landed on it. */
export function landFlight(slug: string, target: HTMLImageElement | null) {
  if (!pending || pending.slug !== slug || !target) return false;
  const flight = pending;
  clearTimeout(flight.timer);
  pending = null;

  target.style.visibility = 'hidden';
  // The new page mounts a moment before the window is scrolled back to the top (ScrollToTop runs
  // after layout effects). The photo's position once at the top is worked out now: where it is
  // plus how far the page is still scrolled, so the flight starts with the very first paint.
  const r = target.getBoundingClientRect();
  fly(flight, target, { left: r.left, top: r.top + window.scrollY, width: r.width, height: r.height });
  return true;
}

/*
 * The flying photo is two layers sized to the destination:
 *   box – clips with the destination's rounded corners; moved and scaled (unevenly, when the card
 *         and the header photo have different shapes) along the path
 *   img – counter-scaled inside the box so the photo itself only ever scales evenly
 * Every keyframe is precomputed, because the counter-scale has to be exact at each step.
 */
function fly({ clone, zoom, rect: from }: Pending, target: HTMLImageElement, to: Box) {
  const radius = getComputedStyle(target).borderTopLeftRadius;

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    overflow: 'hidden',
    borderRadius: radius,
    zIndex: '60',
    pointerEvents: 'none',
    willChange: 'transform',
    transformOrigin: '50% 50%',
  });
  const img = document.createElement('img');
  img.src = clone.src;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  Object.assign(img.style, {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block', willChange: 'transform', transformOrigin: '50% 50%',
  });
  box.appendChild(img);
  document.body.appendChild(box);
  clone.remove();

  // the full-size photo replaces the small one inside the copy as soon as it has loaded
  const large = new Image();
  large.onload = () => (img.src = large.src);
  large.src = largeSrc(clone.src);

  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;
  const boxFrames: Keyframe[] = [];
  const imgFrames: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = easeOut(i / STEPS);
    const w = from.width + (to.width - from.width) * p;
    const h = from.height + (to.height - from.height) * p;
    const sx = w / to.width;
    const sy = h / to.height;
    // the photo covers the current box at an even scale, easing out of the card's hover zoom
    const k = Math.max(sx, sy) * (zoom + (1 - zoom) * p);
    const dx = fromCx + (toCx - fromCx) * p - toCx;
    const dy = fromCy + (toCy - fromCy) * p - toCy;
    const offset = i / STEPS;
    boxFrames.push({ offset, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` });
    imgFrames.push({ offset, transform: `scale(${k / sx}, ${k / sy})` });
  }
  const timing: KeyframeAnimationOptions = { duration: DURATION, easing: 'linear', fill: 'forwards' };
  const boxAnim = box.animate(boxFrames, timing);
  img.animate(imgFrames, timing);

  // the real photo appears underneath first, then the copy fades off it
  Promise.all([boxAnim.finished, ready(target)])
    .then(() => {
      target.style.visibility = '';
      return box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
    })
    .catch(() => {
      target.style.visibility = '';
    })
    .finally(() => box.remove());
}

export function cancelFlight() {
  if (!pending) return;
  const { clone, timer } = pending;
  clearTimeout(timer);
  pending = null;
  clone
    .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' })
    .finished.catch(() => {})
    .finally(() => clone.remove());
}
