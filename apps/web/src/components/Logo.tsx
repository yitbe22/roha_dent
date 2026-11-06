import { Link } from 'react-router';

/** Wordmark + stepped-cross mark. Replace with the official logo file when available. */
export function Logo({ tone = 'blue' }: { tone?: 'blue' | 'white' }) {
  const text = tone === 'white' ? 'text-white' : 'text-roha-700';
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${text}`} aria-label="Roha Speciality Dental Center, home">
      <span className={`step-cross block size-8 ${tone === 'white' ? 'bg-adey' : 'bg-roha-700'}`} aria-hidden="true" />
      <span className="leading-none">
        <span className="block text-[1.15rem] font-extrabold tracking-tight">Roha</span>
        <span className={`block text-[0.72rem] font-medium ${tone === 'white' ? 'text-roha-200' : 'text-ink-soft'}`}>
          Speciality Dental Center
        </span>
      </span>
    </Link>
  );
}
