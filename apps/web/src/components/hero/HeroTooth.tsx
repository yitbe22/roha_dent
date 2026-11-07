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
    // Sized like the reference's tooth stage: min(600px, 70vh) tall on desktop, 340px on phones,
    // with the drawing area overflowing it (160% × 120% on desktop) so the tooth never clips.
    <div className="relative isolate h-[340px] w-full lg:h-[min(600px,70vh)] lg:min-h-[360px]" aria-hidden="true">
      <div className="absolute inset-[18%_10%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(61_138_247/0.22),transparent)] blur-[10px]" />
      <div className="pointer-events-none absolute -inset-[10%] lg:inset-x-[-30%]">
        {/* The still was rendered with the camera closer (4.2 vs 5.4), so shrink it to the same size as the live tooth */}
        <img
          src="/img/tooth.webp"
          alt=""
          width={900}
          height={1000}
          fetchPriority="high"
          className={`absolute inset-0 size-full scale-[0.776] object-contain transition-opacity duration-700 ${live ? 'opacity-0' : 'animate-[tooth-float_7s_ease-in-out_infinite]'}`}
        />
        <canvas ref={canvas} className={`absolute inset-0 size-full transition-opacity duration-700 ${live ? 'opacity-100' : 'opacity-0'}`} />
      </div>
    </div>
  );
}
