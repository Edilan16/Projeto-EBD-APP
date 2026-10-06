import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, addDoc, query, where, onSnapshot, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { startOfWeek, format } from 'date-fns';
import { Search, Check, Users, UserCheck, UserX, CircleHelp, CircleCheck, LoaderCircle } from 'lucide-react';

export default function Attendance() {
  const [students, setStudents] = useState([]);
  const [attendanceId, setAttendanceId] = useState(null);
  const [records, setRecords] = useState({});
  const [search, setSearch] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const weekOf = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');

  useEffect(() => {
    const q = query(collection(db, 'attendance'), where('weekOf', '==', weekOf));
    return onSnapshot(q, snap => {
      if (snap.empty) addDoc(collection(db, 'attendance'), { weekOf, createdAt: serverTimestamp() }).then(r => setAttendanceId(r.id)).catch(() => setError('Não foi possível preparar a chamada.'));
      else setAttendanceId(snap.docs[0].id);
    }, () => setError('Não foi possível carregar a chamada.'));
  }, [weekOf]);
  useEffect(() => onSnapshot(collection(db, 'students'), snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))), () => setError('Não foi possível carregar a lista de alunos.')), []);
  useEffect(() => {
    if (!attendanceId) return;
    return onSnapshot(collection(db, 'attendance', attendanceId, 'records'), snap => {
      const next = {};
      snap.docs.forEach(d => { next[d.id] = d.data(); });
      setRecords(next);
    }, () => setError('Não foi possível carregar as presenças.'));
  }, [attendanceId]);

  const presentCount = useMemo(() => students.filter(student => records[student.id]?.present === true).length, [students, records]);
  const absentCount = useMemo(() => students.filter(student => records[student.id]?.present === false).length, [students, records]);
  const pendingCount = students.length - presentCount - absentCount;
  const filtered = useMemo(() => students.filter(student => {
    const matchesSearch = (student.name || '').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'));
    const value = records[student.id]?.present;
    const isPending = value !== true && value !== false;
    return matchesSearch && (!showPendingOnly || isPending);
  }), [students, records, search, showPendingOnly]);
  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 2500); };

  async function setStudentStatus(student, status) {
    if (!attendanceId) return;
    const present = status === 'present' ? true : status === 'absent' ? false : null;
    setSaving(true); setError('');
    try {
      await setDoc(doc(db, 'attendance', attendanceId, 'records', student.id), {
        studentId: student.id,
        studentName: student.name || 'Desconhecido',
        present,
        date: weekOf,
        updatedAt: serverTimestamp()
      });
    } catch {
      setError('Não foi possível salvar a chamada. Verifique sua conexão e tente novamente.');
    } finally { setSaving(false); }
  }

  async function setAll(status) {
    if (!attendanceId || students.length === 0) return;
    if (status === 'absent' && !window.confirm('Marcar todos os alunos como ausentes nesta aula?')) return;
    if (status === 'pending' && !window.confirm('Deixar toda a turma sem marcação nesta aula?')) return;
    const present = status === 'present' ? true : status === 'absent' ? false : null;
    setSaving(true); setError('');
    try {
      for (let start = 0; start < students.length; start += 450) {
        const batch = writeBatch(db);
        students.slice(start, start + 450).forEach(student => batch.set(doc(db, 'attendance', attendanceId, 'records', student.id), {
          studentId: student.id,
          studentName: student.name || 'Desconhecido',
          present,
          date: weekOf,
          updatedAt: serverTimestamp()
        }));
        await batch.commit();
      }
      notify(status === 'present' ? 'Toda a turma foi marcada como presente.' : status === 'absent' ? 'Toda a turma foi marcada como ausente.' : 'Toda a turma voltou para pendente.');
    } catch {
      setError('Não foi possível atualizar toda a chamada. Confira os registros antes de tentar de novo.');
    } finally { setSaving(false); }
  }

  const statusOptions = [
    { value: 'present', label: 'Presente', icon: UserCheck, active: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600' },
    { value: 'absent', label: 'Ausente', icon: UserX, active: 'border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-600' },
    { value: 'pending', label: 'Pendente', icon: CircleHelp, active: 'border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-900/50 dark:text-amber-100' },
  ];

  return <section>
    <div className="mb-6"><p className="page-title">Chamada da semana</p><p className="page-subtitle">Domingo, {format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'dd/MM/yyyy')} · Marque cada aluno como presente, ausente ou pendente.</p></div>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="surface flex items-center gap-3 p-4"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"><Users size={20}/></span><div><p className="text-xl font-bold">{students.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Alunos na turma</p></div></div>
      <div className="surface flex items-center gap-3 p-4"><span className="rounded-xl bg-green-50 p-2.5 text-green-700 dark:bg-green-900/40 dark:text-green-300"><UserCheck size={20}/></span><div><p className="text-xl font-bold">{presentCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Presentes</p></div></div>
      <div className="surface flex items-center gap-3 p-4"><span className="rounded-xl bg-rose-50 p-2.5 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"><UserX size={20}/></span><div><p className="text-xl font-bold">{absentCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Ausentes</p></div></div>
      <div className="surface flex items-center gap-3 p-4"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><CircleHelp size={20}/></span><div><p className="text-xl font-bold">{pendingCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Pendentes</p></div></div>
    </div>
    <div className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative w-full sm:max-w-xs"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="field pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar aluno…" aria-label="Buscar aluno na chamada"/></div><button type="button" aria-pressed={showPendingOnly} onClick={() => setShowPendingOnly(value => !value)} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${showPendingOnly ? 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}><CircleHelp size={16}/>{showPendingOnly ? 'Ver todos' : 'Só pendentes'}<span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{showPendingOnly ? students.length : pendingCount}</span></button></div><div className="flex flex-wrap gap-2"><button onClick={() => setAll('present')} disabled={saving || !students.length} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"><Check size={16}/>Todos presentes</button><button onClick={() => setAll('absent')} disabled={saving || !students.length} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30">Todos ausentes</button><button onClick={() => setAll('pending')} disabled={saving || !students.length} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Limpar marcações</button></div></div>
    {saving && <p role="status" className="flex items-center gap-2 bg-emerald-50 px-5 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><LoaderCircle size={14} className="animate-spin"/>Salvando alterações…</p>}{toast && <p role="status" className="px-5 py-2 text-sm text-emerald-800 dark:text-emerald-200">{toast}</p>}{error && <p role="alert" className="px-5 py-2 text-sm text-red-600">{error}</p>}
    {filtered.length ? <ul className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(student => {
      const value = records[student.id]?.present;
      const status = value === true ? 'present' : value === false ? 'absent' : 'pending';
      return <li key={student.id} className="flex flex-col gap-3 px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><p className="font-medium">{student.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{status === 'present' ? 'Presença confirmada' : status === 'absent' ? 'Falta registrada' : 'Aguardando marcação'}</p></div>
        <div className="grid grid-cols-3 gap-2 sm:w-auto" role="group" aria-label={`Marcação de ${student.name}`}>
          {statusOptions.map(({ value: option, label, icon: Icon, active }) => <button key={option} type="button" aria-pressed={status === option} aria-label={`${label}: ${student.name}`} disabled={saving} onClick={() => setStudentStatus(student, option)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition disabled:opacity-50 sm:px-3 sm:text-sm ${status === option ? active : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}><Icon size={15}/>{label}</button>)}
        </div>
      </li>;
    })}</ul> : <div className="px-6 py-12 text-center"><CircleCheck className="mx-auto mb-3 text-gray-300" size={34}/><p className="font-medium">{search ? 'Nenhum aluno encontrado' : showPendingOnly ? 'Nenhum aluno pendente' : 'Não há alunos cadastrados'}</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{search ? 'Tente buscar por outro nome.' : showPendingOnly ? 'Todos os alunos já estão marcados.' : 'Cadastre alunos antes de iniciar a chamada.'}</p></div>}</div>
  </section>;
}

