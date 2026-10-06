import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useUserRole } from '../hooks/useUserRole';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Users, ClipboardCheck, Wallet, ArrowRight } from 'lucide-react';

const shortcuts = [
  { to: '/attendance', title: 'Fazer chamada', detail: 'Registrar presenças e faltas', icon: ClipboardCheck, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' },
  { to: '/students', title: 'Alunos', detail: 'Consultar cadastros', adminDetail: 'Consultar e atualizar cadastros', icon: Users, color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200' },
  { to: '/teacher-schedule', title: 'Escala', detail: 'Consultar as próximas aulas', adminDetail: 'Ver e organizar as próximas aulas', icon: CalendarDays, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' },
  { to: '/finance-entry', title: 'Lançar no caixa', detail: 'Registrar entradas e retiradas', icon: Wallet, color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200', adminOnly: true },
];

export default function Dashboard() {
  const [user] = useAuthState(auth);
  const { role } = useUserRole(user);
  const visibleShortcuts = shortcuts.filter(item => !item.adminOnly || role === 'admin');
  const [nextClass, setNextClass] = useState(null);
  const [studentCount, setStudentCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([getDocs(collection(db, 'teacherSchedules')), getDocs(collection(db, 'students'))])
      .then(([schedules, students]) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const upcoming = schedules.docs.map(item => ({ ...item.data(), id: item.id })).filter(item => item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        setNextClass(upcoming[0] || null);
        setStudentCount(students.size);
      })
      .catch(() => setError('Não foi possível carregar o resumo. Confira a conexão e tente atualizar.'))
      .finally(() => setLoading(false));
  }, []);
  const dateText = nextClass?.date ? format(parseISO(nextClass.date), "EEEE, d 'de' MMMM", { locale: ptBR }) : '';
  const days = nextClass?.date ? Math.round((parseISO(nextClass.date).setHours(12) - new Date().setHours(12)) / 86400000) : null;
  return <section className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Painel de gestão</p><h1 className="page-title mt-1">Escola Bíblica</h1><p className="page-subtitle">Acesse rapidamente as tarefas e confira a próxima aula.</p></header>
    {error && <p role="alert" className="surface p-4 text-rose-700">{error}</p>}
    <section className="surface overflow-hidden bg-gradient-to-r from-emerald-800 to-teal-700 p-6 text-white sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-emerald-100">PRÓXIMA AULA</p>{loading ? <p className="mt-2">Carregando escala…</p> : nextClass ? <><h2 className="mt-2 text-2xl font-bold capitalize">{dateText}</h2><p className="mt-1 text-emerald-50">Professor(a): <strong>{nextClass.teacher}</strong> · Lição {nextClass.lesson}{nextClass.quarter ? ` · ${nextClass.quarter}` : ''}</p><p className="mt-2 text-sm text-emerald-100">{days === 0 ? 'É hoje' : days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`}</p></> : <><h2 className="mt-2 text-xl font-semibold">Nenhuma aula futura cadastrada</h2><p className="mt-1 text-emerald-100">Inclua a próxima aula na escala para vê-la aqui.</p></>}</div><Link to="/teacher-schedule" className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-white px-4 py-2.5 font-semibold text-emerald-900 hover:bg-emerald-50 sm:self-center">Abrir escala <ArrowRight size={17}/></Link></div></section>
    <section className="grid gap-3 sm:grid-cols-2"><div className="surface flex items-center gap-4 p-5"><span className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"><CalendarDays size={22}/></span><div><p className="text-sm text-gray-500 dark:text-gray-400">Data de hoje</p><p className="font-semibold capitalize">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p></div></div><div className="surface flex items-center gap-4 p-5"><span className="rounded-xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200"><Users size={22}/></span><div><p className="text-sm text-gray-500 dark:text-gray-400">Alunos cadastrados</p><p className="text-2xl font-bold">{loading ? '…' : studentCount ?? '—'}</p></div></div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Acesso rápido</h2><div className="grid gap-3 sm:grid-cols-2">{visibleShortcuts.map(({ to, title, detail, adminDetail, icon: Icon, color }) => <Link key={to} to={to} className="surface flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md"><span className={`rounded-xl p-3 ${color}`}><Icon size={22}/></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block text-sm text-gray-500 dark:text-gray-400">{role === 'admin' && adminDetail ? adminDetail : detail}</span></span><ArrowRight size={18} className="text-gray-400"/></Link>)}</div></section>
  </section>;
}

