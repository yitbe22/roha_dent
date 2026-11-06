import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { errorMessage } from '../data';
import { APPOINTMENT_SELECT, type Appointment, type Patient } from '../types';
import { Card, Empty, ErrorBox, Field, Loading, PageHeader, Phone, btn, inputCls, useToast } from '../ui';
import { AppointmentList } from './Appointments';

export default function PatientDetailPage() {
  const { id } = useParams();
  const patient = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('id, full_name, phone, email, notes, created_at').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Patient | null;
    },
  });
  const appts = useQuery({
    queryKey: ['appointments', 'patient', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select(APPOINTMENT_SELECT).eq('patient_id', id!).order('starts_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Appointment[];
    },
  });

  if (patient.isError) return <ErrorBox error={errorMessage(patient.error)} onRetry={() => patient.refetch()} />;
  if (patient.isPending) return <Loading />;
  if (!patient.data) return <ErrorBox error="Patient not found (or they have no bookings at your clinic)." />;
  const p = patient.data;
  const now = Date.now();
  const upcoming = (appts.data ?? []).filter((a) => new Date(a.starts_at).getTime() >= now).reverse();
  const past = (appts.data ?? []).filter((a) => new Date(a.starts_at).getTime() < now);
  const noShows = past.filter((a) => a.status === 'no_show').length;

  return (
    <>
      <p className="mb-2 text-sm"><Link to="/admin/patients" className="link">← Patients</Link></p>
      <PageHeader title={p.full_name} subtitle={<><Phone e164={p.phone} />{noShows > 0 && <span className="ml-3 font-semibold text-red-700">{noShows} no-show{noShows > 1 ? 's' : ''}</span>}</>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 text-lg">Upcoming</h2>
            {appts.isPending ? <Loading /> : upcoming.length ? <AppointmentList items={upcoming} showDate /> : <Empty>No upcoming appointments.</Empty>}
          </section>
          <section>
            <h2 className="mb-2 text-lg">History</h2>
            {appts.isPending ? <Loading /> : past.length ? <AppointmentList items={past} showDate /> : <Empty>No past visits.</Empty>}
          </section>
        </div>
        <EditPatient p={p} />
      </div>
    </>
  );
}

function EditPatient({ p }: { p: Patient }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(p.full_name);
  const [email, setEmail] = useState(p.email ?? '');
  const [notes, setNotes] = useState(p.notes ?? '');
  useEffect(() => {
    setName(p.full_name);
    setEmail(p.email ?? '');
    setNotes(p.notes ?? '');
  }, [p]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('patients')
        .update({ full_name: name.trim(), email: email.trim() || null, notes: notes.trim() || null }).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast('Patient saved');
      qc.invalidateQueries({ queryKey: ['patient'] });
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Card title="Details">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <input className={inputCls} value={name} minLength={2} maxLength={100} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Phone" hint="The phone number identifies the patient and can’t be changed here.">
          <input className={inputCls} value={p.phone} disabled />
        </Field>
        <Field label="Email (optional)">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Notes" hint="Internal — allergies, preferences, payment notes…">
          <textarea className={`${inputCls} min-h-28`} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" className={btn.primary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
      </form>
    </Card>
  );
}
