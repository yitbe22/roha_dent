import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import type { Dentist } from '../content/dentists';
import { Monogram } from './Monogram';
import { srcSet } from '../lib/img';

/**
 * A dentist's photo, or their initials tile when there is no photo yet.
 * Stock stand-ins (`photoIsSample`) carry a visible "Sample photo" tag so nobody
 * mistakes the model for the named dentist; `tag={false}` hides it on tiny avatars,
 * where the full-size profile on /doctors still shows it.
 */
export function DentistAvatar({ dentist: d, className, shape = 'circle', tag = true }: {
  dentist: Dentist; className?: string; shape?: 'circle' | 'tile'; tag?: boolean;
}) {
  const { t } = useTranslation();
  if (!d.photo) return <Monogram name={d.name} shape={shape} className={className} />;
  return (
    <span className={cn('relative block shrink-0 overflow-hidden', shape === 'circle' ? 'rounded-full' : 'rounded-card', className)}>
      <img src={d.photo} srcSet={srcSet(d.photo, 800)} sizes={shape === 'tile' ? '(min-width: 1024px) 18rem, 50vw' : '4rem'}
        alt={d.photoIsSample ? '' : d.name} width={800} height={1000} loading="lazy" decoding="async"
        className="size-full object-cover object-top" />
      {d.photoIsSample && tag && (
        <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-0.5 text-[0.6875rem] font-medium text-white backdrop-blur-sm">
          {t('common.samplePhoto')}
        </span>
      )}
    </span>
  );
}
