import { cn } from 'cn';

/** Initials tile used until real dentist photos exist. */
export function Monogram({ name, className, shape = 'circle' }: { name: string; className?: string; shape?: 'circle' | 'tile' }) {
  const initials = name.replace(/^Dr\.?\s*/, '').split(' ').map((p) => p[0]).join('').slice(0, 2);
  return (
    <span
      aria-hidden="true"
      className={cn(
        shape === 'circle' ? 'rounded-full' : 'rounded-card',
        'grid shrink-0 place-items-center bg-gradient-to-br from-[#eaf2ff] to-[#c9dcff] font-display font-medium tracking-[-0.03em] text-roha-700',
        className,
      )}
    >
      {initials}
    </span>
  );
}
