// Small composites shared by several dashboard pages.
import { addDays, clinicDateKey } from '@shared/time.ts';
import { useAuth } from '../auth';
import { useLookups } from '../data';
import { btn, inputInline } from '../ui';

/** Owner: pick a clinic or "Both clinics". Staff: fixed label. */
export function ScopeSelect({ allowAll = true }: { allowAll?: boolean }) {
  const auth = useAuth();
  const { data: lk } = useLookups();
  if (!lk) return null;
  if (!auth.isOwner) {
    return <span className="rounded-lg bg-mist px-3 py-2 font-semibold text-roha-800">{lk.location(auth.scope)?.city} clinic</span>;
  }
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-ink-soft">Clinic</span>
      <select className={`${inputInline} w-auto`} value={auth.scope ?? ''} onChange={(e) => auth.setScope(e.target.value || null)}>
        {allowAll && <option value="">Both clinics</option>}
        {lk.locations.map((l) => (
          <option key={l.id} value={l.id}>{l.city}{l.is_active ? '' : ' (closed)'}</option>
        ))}
      </select>
    </label>
  );
}

/** ‹ Today › with a date picker; value is a clinic date key (YYYY-MM-DD). */
export function DateNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = clinicDateKey();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn.ghost} onClick={() => onChange(addDays(value, -1))}>‹ Previous day</button>
      <button type="button" className={value === today ? btn.primary : btn.ghost} onClick={() => onChange(today)}>Today</button>
      <button type="button" className={btn.ghost} onClick={() => onChange(addDays(value, 1))}>Next day ›</button>
      <label className="flex items-center gap-2">
        <span className="sr-only">Go to date</span>
        <input type="date" className={`${inputInline} w-auto`} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
    </div>
  );
}

/** Location the current user may write to: staff → own; owner → chosen clinic or the first active one. */
export function useWriteLocation(): string | undefined {
  const auth = useAuth();
  const { data: lk } = useLookups();
  return auth.scope ?? auth.profile?.location_id ?? lk?.locations.find((l) => l.is_active)?.id;
}
