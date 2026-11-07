import { Link } from 'react-router';

/** The clinic's mark + wordmark. */
export function Logo({ tone = 'blue', to = '/' }: { tone?: 'blue' | 'white'; to?: string }) {
  const white = tone === 'white';
  return (
    <Link to={to} className={`flex items-center gap-2.5 ${white ? 'text-white' : 'text-ink'}`} aria-label="Roha Speciality Dental Center, home">
      <img
        src={white ? '/img/logo-white.png' : '/img/logo.png'}
        alt=""
        width={141}
        height={160}
        className="h-9 w-auto"
      />
      <span className="leading-none">
        <span className="block font-display text-[1.0625rem] font-semibold tracking-[-0.01em]">Roha</span>
        <span className={`mt-0.5 block text-[0.6875rem] tracking-[0.02em] ${white ? 'text-white/70' : 'text-muted'}`}>
          Speciality Dental Center
        </span>
      </span>
    </Link>
  );
}
