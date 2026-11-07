import { useEffect, useRef, useState } from 'react';
import { INTRO_MS } from '../../lib/intro';

const DESKTOP = '(min-width: 1024px) and (pointer: fine)';

/** True only for hardware-accelerated WebGL; software renderers can't animate the glass smoothly. */
function hasFastWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

/**
 * The hero tooth. Everyone first gets a still image (prerendered, so it shows instantly).
 * Desktop with motion allowed: the live 3D glass tooth loads in the background and
 * replaces the image. Phones and tablets keep the image, which floats gently.
 */
export function HeroTooth() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!matchMedia(DESKTOP).matches || matchMedia('(prefers-reduced-motion: reduce)').matches || !hasFastWebGL()) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const run = async () => {
      try {
        const { mountTooth } = await import('./toothScene');
        if (cancelled || !canvas.current) return;
        const startAt = document.documentElement.classList.contains('show-loader') ? INTRO_MS : 0;
        dispose = mountTooth(canvas.current, {
          startAt,
          onSlow: () => {
            setLive(false);
            window.setTimeout(() => { dispose?.(); dispose = undefined; }, 700); // after the cross-fade
          },
        });
        requestAnimationFrame(() => !cancelled && setLive(true));
      } catch (e) {
        console.warn('3D tooth unavailable, keeping the image', e);
      }
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void run(), { timeout: 1200 })
      : window.setTimeout(() => void run(), 200);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
      dispose?.();
    };
  }, []);

  return (
    <div className="relative isolate mx-auto aspect-[9/10] w-full max-w-[22rem] sm:max-w-[26rem] lg:max-w-[34rem]" aria-hidden="true">
      <div className="absolute inset-[6%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(61_138_247/0.28),rgb(61_138_247/0.08)_60%,transparent)]" />
      <img
        src="/img/tooth.webp"
        alt=""
        width={900}
        height={1000}
        fetchPriority="high"
        className={`absolute inset-0 size-full object-contain transition-opacity duration-700 ${live ? 'opacity-0' : 'animate-[tooth-float_7s_ease-in-out_infinite]'}`}
      />
      <canvas ref={canvas} className={`absolute inset-0 size-full transition-opacity duration-700 ${live ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
