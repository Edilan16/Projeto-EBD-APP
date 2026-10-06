import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, runTransaction, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useUserRole } from '../hooks/useUserRole';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock3, Download, Search, UserRound, Pencil, Trash2, BookOpen, Users } from 'lucide-react';

const emptyForm = { teacher: '', date: '', lesson: '', quarter: '' };
const today = () => format(new Date(), 'yyyy-MM-dd');
const readableDate = value => {
  const date = parseISO(value || '');
  return isValid(date) ? format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : value || 'Data não informada';
};

export default function TeacherSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [user] = useAuthState(auth);
  const { role } = useUserRole(user);
  const canEdit = role === 'admin';
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('upcoming');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('asc');
  const currentDate = today();

  useEffect(() => onSnapshot(collection(db, 'teacherSchedules'), snapshot => {
    setSchedules(snapshot.docs.map(item => ({ ...item.data(), id: item.id })).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    setLoading(false);
    setError('');
  }, () => { setError('Não foi possível carregar a escala. Confira sua conexão e tente novamente.'); setLoading(false); }), []);

  useEffect(() => {
    let active = true;
    async function migrateLocalSchedules() {
      if (role !== 'admin' || localStorage.getItem('teacherSchedulesMigratedToFirestore')) return;
      try {
        const saved = JSON.parse(localStorage.getItem('teacherSchedules') || '[]');
        for (const item of saved) {
          if (!item?.date || !item?.teacher) continue;
          const scheduleRef = doc(db, 'teacherSchedules', item.date);
          const existing = await getDoc(scheduleRef);
          if (!existing.exists()) await setDoc(scheduleRef, { teacher: item.teacher, date: item.date, lesson: String(item.lesson || ''), quarter: item.quarter || '', createdAt: new Date().toISOString() });
        }
        if (active) localStorage.setItem('teacherSchedulesMigratedToFirestore', 'true');
      } catch {
        if (active) setError('Não foi possível transferir a escala salva neste navegador. Atualize a página para tentar de novo.');
      }
    }
    migrateLocalSchedules();
    return () => { active = false; };
  }, [role]);

  function showToast(message) { setToast(message); setTimeout(() => setToast(''), 3000); }
  function handleChange(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); }
  function handleCancel() { setForm(emptyForm); setEditingId(null); }
  function changeView(nextView) {
    setView(nextView);
    if (sortBy === 'date') setSortDir(nextView === 'past' ? 'desc' : 'asc');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.teacher.trim() || !form.date || !/^\d+$/.test(form.lesson) || Number(form.lesson) < 1 || !form.quarter.trim()) {
      showToast('Preencha professor, data, lição e trimestre corretamente.');
      return;
    }
    try {
      const targetRef = doc(db, 'teacherSchedules', form.date);
      await runTransaction(db, async transaction => {
        const target = await transaction.get(targetRef);
        if (target.exists() && targetRef.id !== editingId) throw new Error('duplicate');
        if (editingId && editingId !== form.date) transaction.delete(doc(db, 'teacherSchedules', editingId));
        transaction.set(targetRef, { ...form, teacher: form.teacher.trim().replace(/\s+/g, ' '), quarter: form.quarter.trim(), lesson: String(form.lesson), updatedAt: new Date().toISOString() });
      });
      showToast(editingId ? 'Escala alterada.' : 'Aula adicionada à escala.');
      handleCancel();
    } catch (err) {
      showToast(err.message === 'duplicate' ? 'Já existe uma escala para esta data.' : 'Não foi possível salvar. Verifique sua conexão e tente novamente.');
    }
  }

  function handleEdit(item) {
    setForm({ teacher: item.teacher || '', date: item.date || '', lesson: String(item.lesson || ''), quarter: item.quarter || '' });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir a escala de ${item.teacher} em ${readableDate(item.date)}?`)) return;
    try {
      await runTransaction(db, transaction => transaction.delete(doc(db, 'teacherSchedules', item.id)));
      showToast('Aula removida da escala.');
      if (editingId === item.id) handleCancel();
    } catch { showToast('Não foi possível excluir. Tente novamente.'); }
  }

  const counts = useMemo(() => ({
    upcoming: schedules.filter(item => item.date >= currentDate).length,
    past: schedules.filter(item => item.date < currentDate).length,
    all: schedules.length
  }), [schedules, currentDate]);

  const nextClass = useMemo(() => schedules.filter(item => item.date >= currentDate).sort((a, b) => a.date.localeCompare(b.date))[0] || null, [schedules, currentDate]);
  const visibleSchedules = useMemo(() => {
    const queryText = search.trim().toLocaleLowerCase('pt-BR');
    return schedules
      .filter(item => view === 'all' || (view === 'upcoming' ? item.date >= currentDate : item.date < currentDate))
      .filter(item => !queryText || [item.teacher, item.date, readableDate(item.date), item.lesson, item.quarter].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(queryText)))
      .slice()
      .sort((a, b) => {
        const left = sortBy === 'lesson' ? Number(a[sortBy]) : String(a[sortBy] || '').toLocaleLowerCase('pt-BR');
        const right = sortBy === 'lesson' ? Number(b[sortBy]) : String(b[sortBy] || '').toLocaleLowerCase('pt-BR');
        return (left < right ? -1 : left > right ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
      });
  }, [schedules, view, currentDate, search, sortBy, sortDir]);

  function handleSort(field) {
    if (sortBy === field) setSortDir(value => value === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir(field === 'date' && view === 'past' ? 'desc' : 'asc'); }
  }

  function downloadCSV() {
    const rows = [['Professor', 'Data', 'Lição', 'Trimestre'], ...visibleSchedules.map(item => [item.teacher, readableDate(item.date), item.lesson, item.quarter])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `escala-professores-${view}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const viewOptions = [
    { key: 'upcoming', label: 'Próximas', icon: CalendarDays },
    { key: 'past', label: 'Realizadas', icon: Clock3 },
    { key: 'all', label: 'Todas', icon: Users }
  ];

  function renderActions(item) {
    if (!canEdit) return null;
    return <div className="flex gap-2">
      <button type="button" onClick={() => handleEdit(item)} aria-label={`Editar escala de ${item.teacher}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Pencil size={15}/>Editar</button>
      <button type="button" onClick={() => handleDelete(item)} aria-label={`Excluir escala de ${item.teacher}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={15}/>Excluir</button>
    </div>;
  }

  return <section className="mx-auto max-w-5xl space-y-5">
    <header>
      <p className="page-title">Escala de professores</p>
      <p className="page-subtitle">Consulte rapidamente quem dará cada aula e o que já aconteceu.</p>
      {!canEdit && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Você pode consultar as aulas. Alterações na escala são feitas por um administrador.</p>}
    </header>

    {nextClass && <section className="surface overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-gray-800 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Próxima aula</p>
          <h2 className="mt-1 text-xl font-bold capitalize text-gray-900 dark:text-white">{readableDate(nextClass.date)}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
            <span className="inline-flex items-center gap-1.5"><UserRound size={16}/>{nextClass.teacher}</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen size={16}/>Lição {nextClass.lesson}{nextClass.quarter ? ` · ${nextClass.quarter}` : ''}</span>
          </div>
        </div>
        <span className="self-start rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white sm:self-center">
          {differenceInCalendarDays(parseISO(nextClass.date), parseISO(currentDate)) === 0 ? 'É hoje' : differenceInCalendarDays(parseISO(nextClass.date), parseISO(currentDate)) === 1 ? 'Amanhã' : `Em ${differenceInCalendarDays(parseISO(nextClass.date), parseISO(currentDate))} dias`}
        </span>
      </div>
    </section>}

    {toast && <p role="status" className="surface border-l-4 border-emerald-600 p-3">{toast}</p>}
    {error && <p role="alert" className="surface border-l-4 border-rose-600 p-3 text-rose-800">{error}</p>}

    {canEdit && <form onSubmit={handleSubmit} className="surface grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
      <div className="sm:col-span-2"><h2 className="font-semibold">{editingId ? 'Editar aula da escala' : 'Adicionar aula à escala'}</h2><p className="mt-1 text-sm text-gray-500">Informe os dados para a equipe consultar em todos os dispositivos.</p></div>
      <label className="text-sm font-medium">Professor<input name="teacher" value={form.teacher} onChange={handleChange} placeholder="Nome do professor" className="field mt-1" maxLength={100} required /></label>
      <label className="text-sm font-medium">Data da aula<input name="date" type="date" value={form.date} onChange={handleChange} className="field mt-1" required /></label>
      <label className="text-sm font-medium">Número da lição<input name="lesson" type="number" min="1" step="1" value={form.lesson} onChange={handleChange} placeholder="Ex.: 5" className="field mt-1" required /></label>
      <label className="text-sm font-medium">Trimestre<input name="quarter" value={form.quarter} onChange={handleChange} placeholder="Ex.: 1º trimestre de 2026" className="field mt-1" maxLength={80} required /></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn-primary" type="submit">{editingId ? 'Salvar alterações' : 'Adicionar à escala'}</button>{editingId && <button type="button" onClick={handleCancel} className="min-h-10 rounded-lg border px-4 py-2">Cancelar</button>}</div>
    </form>}

    <section className="surface overflow-hidden">
      <div className="space-y-4 border-b border-gray-100 p-4 dark:border-gray-700 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar escala por período">
          {viewOptions.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${view === key ? 'bg-emerald-700 text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}><Icon size={16}/>{label}<span className={`rounded-full px-1.5 py-0.5 text-xs ${view === key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{counts[key]}</span></button>)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar professor, data, lição ou trimestre…" aria-label="Buscar na escala" className="field pl-9"/></div>
          <button type="button" onClick={downloadCSV} disabled={!visibleSchedules.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Download size={16}/>Baixar lista</button>
        </div>
      </div>

      {loading ? <p role="status" className="py-10 text-center text-gray-500">Carregando escala…</p> : visibleSchedules.length ? <>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
          {visibleSchedules.map(item => <li key={item.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold capitalize text-gray-900 dark:text-white">{readableDate(item.date)}</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300"><UserRound size={15}/>{item.teacher}</p></div>{item.date >= currentDate && <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Próxima</span>}</div>
            <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">Lição {item.lesson}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">{item.quarter || 'Trimestre não informado'}</span></div>
            {renderActions(item)}
          </li>)}
        </ul>
        <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{[['teacher','Professor'],['date','Data'],['lesson','Lição'],['quarter','Trimestre']].map(([field,label]) => <th key={field} className="px-4 py-3"><button type="button" className="font-semibold" onClick={() => handleSort(field)}>{label}{sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>)}{canEdit && <th className="px-4 py-3">Ações</th>}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{visibleSchedules.map(item => <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40"><td className="px-4 py-3 font-medium">{item.teacher}</td><td className="px-4 py-3 capitalize">{readableDate(item.date)}</td><td className="px-4 py-3">{item.lesson}</td><td className="px-4 py-3">{item.quarter || '—'}</td>{canEdit && <td className="px-4 py-3">{renderActions(item)}</td>}</tr>)}</tbody></table></div>
      </> : <div className="px-5 py-12 text-center"><CalendarDays className="mx-auto mb-3 text-gray-300" size={34}/><p className="font-semibold">{search ? 'Nenhuma aula encontrada' : view === 'upcoming' ? 'Nenhuma aula futura cadastrada' : view === 'past' ? 'Ainda não há aulas realizadas' : 'A escala está vazia'}</p><p className="mt-1 text-sm text-gray-500">{search ? 'Tente buscar por outro nome, data ou trimestre.' : view === 'upcoming' && canEdit ? 'Adicione a próxima aula no formulário acima.' : 'As aulas aparecerão aqui quando forem cadastradas.'}</p></div>}
    </section>
  </section>;
}
