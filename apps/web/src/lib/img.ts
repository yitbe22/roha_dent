/**
 * srcSet for a photo that has a half-width "-sm" copy next to it (made by scripts/optimize-images.mjs),
 * so small cards and avatars download the small file and big headers the full one.
 */
export const srcSet = (src: string, fullWidth: number) =>
  `${src.replace(/\.webp$/, '-sm.webp')} ${Math.round(fullWidth / 2)}w, ${src} ${fullWidth}w`;
