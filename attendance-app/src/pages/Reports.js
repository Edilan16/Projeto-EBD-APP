import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Search, CalendarDays, UserCheck, UserX, CircleHelp, Download, TrendingUp, ClipboardList } from 'lucide-react';

const dateLabel = date => format(parseISO(date), 'dd/MM/yyyy');
const percent = (present, marked) => marked ? (present / marked) * 100 : 0;
const getQuarterKey = date => {
  const parsed = parseISO(date);
  return `${parsed.getFullYear()}-T${Math.floor(parsed.getMonth() / 3) + 1}`;
};
const getQuarterTitle = key => {
  if (!key) return 'Nenhum trimestre';
  const [year, number] = key.split('-T');
  return `${number}º trimestre de ${year}`;
};
const getLessonNumber = (date, key) => {
  const [year, quarter] = key.split('-T').map(Number);
  const firstSunday = new Date(year, (quarter - 1) * 3, 1);
  firstSunday.setDate(firstSunday.getDate() + ((7 - firstSunday.getDay()) % 7));
  return Math.floor(differenceInCalendarDays(parseISO(date), firstSunday) / 7) + 1;
};
const wasEnrolled = (student, sessionDate) => {
  if (!student.createdAt) return true;
  const createdAt = student.createdAt?.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
  return Number.isNaN(createdAt.getTime()) || format(createdAt, 'yyyy-MM-dd') <= sessionDate;
};

export default function Reports() {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const quarterOptions = useMemo(() => [...new Set(sessions.map(session => getQuarterKey(session.date)))].sort().reverse(), [sessions]);
  useEffect(() => {
    if (!selectedQuarter && quarterOptions.length) setSelectedQuarter(quarterOptions[0]);
  }, [quarterOptions, selectedQuarter]);

  useEffect(() => {
    let active = true;
    async function loadAttendance() {
      try {
        const [attendanceSnap, studentsSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'students'))
        ]);
        const roster = studentsSnap.docs.map(d => ({ id: d.id, name: d.data().name || 'Sem nome', createdAt: d.data().createdAt }));
        const rosterById = new Map(roster.map(student => [student.id, student.name]));
        const sessionParts = await Promise.all(attendanceSnap.docs.map(async sessionDoc => {
          const data = sessionDoc.data();
          const recordSnap = await getDocs(collection(db, 'attendance', sessionDoc.id, 'records'));
          const records = {};
          recordSnap.docs.forEach(recordDoc => {
            const record = recordDoc.data();
            const studentId = record.studentId || recordDoc.id;
            records[studentId] = {
              studentId,
              studentName: record.studentName || rosterById.get(studentId) || 'Aluno não cadastrado',
              present: record.present,
              date: record.date
            };
          });
          const date = data.weekOf || Object.values(records).find(record => record.date)?.date || sessionDoc.id;
          return { date, records };
        }));
        const byDate = new Map();
        sessionParts.forEach(part => {
          if (!byDate.has(part.date)) byDate.set(part.date, { date: part.date, records: {} });
          Object.assign(byDate.get(part.date).records, part.records);
        });
        if (active) {
          setStudents(roster);
          setSessions([...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)));
        }
      } catch {
        if (active) setError('Não foi possível carregar as chamadas. Tente atualizar o relatório.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadAttendance();
    return () => { active = false; };
  }, []);

  const filteredSessions = useMemo(() => sessions
    .filter(session => !selectedQuarter || getQuarterKey(session.date) === selectedQuarter)
    .map(session => ({ ...session, lessonNumber: getLessonNumber(session.date, selectedQuarter || getQuarterKey(session.date)) }))
    .sort((a, b) => b.date.localeCompare(a.date)), [sessions, selectedQuarter]);

  const attendanceStats = useMemo(() => {
    const createStats = (id, name) => ({ id, name, present: 0, absent: 0, probableAbsent: 0, marked: 0, pending: 0 });
    const stats = new Map(students.map(student => [student.id, createStats(student.id, student.name)]));
    filteredSessions.forEach(session => {
      const records = Object.values(session.records);
      records.forEach(record => {
        if (!stats.has(record.studentId)) stats.set(record.studentId, createStats(record.studentId, record.studentName));
        const item = stats.get(record.studentId);
        if (record.present === true) { item.present += 1; item.marked += 1; }
        else if (record.present === false) { item.absent += 1; item.marked += 1; }
        else item.pending += 1;
      });
      // Quando há registros na aula, alunos já matriculados e sem registro entram como falta provável.
      if (records.length > 0) {
        const recordedIds = new Set(records.map(record => record.studentId));
        students.forEach(student => {
          if (recordedIds.has(student.id) || !wasEnrolled(student, session.date)) return;
          const item = stats.get(student.id);
          if (item) { item.probableAbsent += 1; item.marked += 1; }
        });
      }
    });
    return [...stats.values()].map(item => ({ ...item, totalAbsences: item.absent + item.probableAbsent, rate: percent(item.present, item.marked) }));
  }, [students, filteredSessions]);

  const searchTerm = search.trim().toLocaleLowerCase('pt-BR');
  const visibleStats = useMemo(() => attendanceStats.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(searchTerm)), [attendanceStats, searchTerm]);
  const mostFrequent = useMemo(() => visibleStats.filter(item => item.present > 0).sort((a, b) => b.present - a.present || b.rate - a.rate || a.name.localeCompare(b.name, 'pt-BR')), [visibleStats]);
  const mostAbsent = useMemo(() => visibleStats.filter(item => item.totalAbsences > 0).sort((a, b) => b.totalAbsences - a.totalAbsences || a.rate - b.rate || a.name.localeCompare(b.name, 'pt-BR')), [visibleStats]);

  const summary = useMemo(() => {
    const present = attendanceStats.reduce((sum, item) => sum + item.present, 0);
    const confirmedAbsent = attendanceStats.reduce((sum, item) => sum + item.absent, 0);
    const probableAbsent = attendanceStats.reduce((sum, item) => sum + item.probableAbsent, 0);
    const absent = confirmedAbsent + probableAbsent;
    return { present, confirmedAbsent, probableAbsent, absent, rate: percent(present, present + absent) };
  }, [attendanceStats]);

  function exportToExcel() {
    const workbook = XLSX.utils.book_new();
    const summaryRows = visibleStats.map(item => ({
      Aluno: item.name,
      Presenças: item.present,
      'Faltas confirmadas': item.absent,
      'Faltas prováveis (sem marcação)': item.probableAbsent,
      'Total de faltas': item.totalAbsences,
      'Chamadas consideradas': item.marked,
      'Frequência (%)': item.marked ? Number(item.rate.toFixed(1)) : 'Sem registros'
    }));
    const lessonRows = filteredSessions.map(session => {
      const records = Object.values(session.records);
      const recordedIds = new Set(records.map(record => record.studentId));
      return {
        Aula: `Aula ${session.lessonNumber} - ${dateLabel(session.date)}`,
        Presentes: records.filter(record => record.present === true).map(record => record.studentName).join(', '),
        'Faltas confirmadas': records.filter(record => record.present === false).map(record => record.studentName).join(', '),
        'Faltas prováveis': records.length ? students.filter(student => !recordedIds.has(student.id) && wasEnrolled(student, session.date)).map(student => student.name).join(', ') : 'Chamada sem registros',
        'Sem status': records.filter(record => record.present !== true && record.present !== false).map(record => record.studentName).join(', ')
      };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumo por aluno');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lessonRows), 'Aulas do trimestre');
    XLSX.writeFile(workbook, `frequencia_${selectedQuarter || 'geral'}.xlsx`);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatório de frequência - ${getQuarterTitle(selectedQuarter)}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Chamadas: ${filteredSessions.length}/13 | Presenças: ${summary.present} | Faltas: ${summary.absent} (${summary.confirmedAbsent} confirmadas, ${summary.probableAbsent} prováveis) | Frequência: ${summary.rate.toFixed(1)}%`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [['Aluno', 'Presenças', 'Faltas confirmadas', 'Prováveis', 'Frequência']],
      body: visibleStats.map(item => [item.name, item.present, item.absent, item.probableAbsent, item.marked ? `${item.rate.toFixed(1)}%` : 'Sem registros'])
    });
    let y = (doc.lastAutoTable?.finalY || 30) + 12;
    filteredSessions.forEach(session => {
      if (y > 260) { doc.addPage(); y = 18; }
      doc.setFontSize(12);
      doc.text(`${session.lessonNumber <= 13 ? `Aula ${session.lessonNumber}` : 'Aula extra'} - ${dateLabel(session.date)}`, 14, y);
      y += 3;
      const records = Object.values(session.records);
      const recordedIds = new Set(records.map(record => record.studentId));
      const probable = records.length ? students.filter(student => !recordedIds.has(student.id) && wasEnrolled(student, session.date)).map(student => student.name).join(', ') || 'Nenhum' : 'Chamada sem registros';
      autoTable(doc, {
        startY: y,
        head: [['Presentes', 'Faltas confirmadas', 'Faltas prováveis', 'Sem status']],
        body: [[
          records.filter(record => record.present === true).map(record => record.studentName).join(', ') || 'Nenhum',
          records.filter(record => record.present === false).map(record => record.studentName).join(', ') || 'Nenhuma',
          probable,
          records.filter(record => record.present !== true && record.present !== false).map(record => record.studentName).join(', ') || 'Nenhum'
        ]],
        styles: { fontSize: 8, cellWidth: 'wrap' }
      });
      y = (doc.lastAutoTable?.finalY || y) + 10;
    });
    doc.save(`frequencia_${selectedQuarter || 'geral'}.pdf`);
  }

  if (loading) return <div role="status" className="surface p-8 text-center">Carregando chamadas…</div>;
  if (error) return <div role="alert" className="surface p-6 text-red-700">{error}</div>;

  const RankList = ({ title, items, type }) => <section className="surface overflow-hidden">
    <div className="border-b border-gray-100 p-4 dark:border-gray-700">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{type === 'present' ? 'Ordenados pelo total de presenças.' : 'O total separa faltas confirmadas de faltas prováveis.'}</p>
    </div>
    {items.length ? <ol className="divide-y divide-gray-100 dark:divide-gray-700">{items.slice(0, 8).map((item, index) => <li key={item.id} className="flex items-center gap-3 p-3 sm:px-4">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200'}`}>{index + 1}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.name}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className={`h-full rounded-full ${type === 'present' ? 'bg-emerald-600' : 'bg-rose-500'}`} style={{ width: `${item.rate}%` }}/></div></div>
      <div className="text-right"><p className={`font-semibold ${type === 'present' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{type === 'present' ? `${item.present} ${item.present === 1 ? 'presença' : 'presenças'}` : `${item.totalAbsences} ${item.totalAbsences === 1 ? 'falta' : 'faltas'}`}</p><p className="text-xs text-gray-500 dark:text-gray-400">{type === 'present' ? `${item.rate.toFixed(0)}% · ${item.marked} chamadas` : `${item.absent} confirmadas + ${item.probableAbsent} prováveis`}</p></div>
    </li>)}</ol> : <p className="p-6 text-center text-sm text-gray-500">{type === 'present' ? 'Ainda não há presenças registradas neste trimestre.' : 'Nenhuma falta encontrada neste trimestre.'}</p>}
  </section>;

  return <section className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-title">Relatório de frequência</h1><p className="page-subtitle">Acompanhe cada aula e veja a frequência do trimestre.</p></div><div className="flex flex-wrap gap-2"><button onClick={exportToExcel} disabled={!filteredSessions.length} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"><Download size={16}/>Excel</button><button onClick={exportToPDF} disabled={!filteredSessions.length} className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"><Download size={16}/>PDF</button></div></header>
    <section className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-xs"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="field pl-9" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar aluno…" aria-label="Buscar aluno no relatório"/></div><label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><CalendarDays size={17}/><span>Trimestre:</span><select className="field w-auto" value={selectedQuarter} onChange={event => setSelectedQuarter(event.target.value)} aria-label="Selecionar trimestre">{quarterOptions.map(key => <option key={key} value={key}>{getQuarterTitle(key)}</option>)}</select></label></section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="surface flex items-center gap-3 p-4"><ClipboardList className="text-blue-700 dark:text-blue-300"/><div><p className="text-2xl font-bold">{filteredSessions.length} / 13</p><p className="text-xs text-gray-500 dark:text-gray-400">Chamadas · referência do trimestre</p></div></div><div className="surface flex items-center gap-3 p-4"><UserCheck className="text-emerald-700 dark:text-emerald-300"/><div><p className="text-2xl font-bold">{summary.present}</p><p className="text-xs text-gray-500 dark:text-gray-400">Presenças</p></div></div><div className="surface flex items-center gap-3 p-4"><UserX className="text-rose-700 dark:text-rose-300"/><div><p className="text-2xl font-bold">{summary.absent}</p><p className="text-xs text-gray-500 dark:text-gray-400">Faltas confirmadas + prováveis</p></div></div><div className="surface flex items-center gap-3 p-4"><TrendingUp className="text-violet-700 dark:text-violet-300"/><div><p className="text-2xl font-bold">{summary.rate.toFixed(1)}%</p><p className="text-xs text-gray-500 dark:text-gray-400">Frequência geral</p></div></div></section>
    <p className="-mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400"><CircleHelp size={15} className="mt-0.5 shrink-0"/>Falta provável significa aluno atual sem registro numa chamada iniciada. Confira esses casos antes de fechar o trimestre; uma chamada sem nenhum registro não gera faltas prováveis.</p>
    {!filteredSessions.length ? <section className="surface px-6 py-12 text-center"><CalendarDays className="mx-auto mb-3 text-gray-300" size={36}/><h2 className="font-semibold">Nenhuma aula encontrada</h2><p className="mt-1 text-sm text-gray-500">Registre uma chamada neste trimestre ou selecione outro trimestre com dados.</p></section> : <>
      <div className="grid gap-4 lg:grid-cols-2"><RankList title="Quem mais frequenta" items={mostFrequent} type="present"/><RankList title="Quem tem mais faltas" items={mostAbsent} type="absent"/></div>
      <section><div className="mb-3"><h2 className="text-lg font-semibold">Presença em cada aula</h2><p className="text-sm text-gray-500 dark:text-gray-400">As aulas são numeradas pelos domingos do trimestre. Abra uma data para ver os nomes.</p></div><div className="space-y-3">{filteredSessions.map(session => {
        const records = Object.values(session.records);
        const present = records.filter(record => record.present === true);
        const absent = records.filter(record => record.present === false);
        const pendingRecords = records.filter(record => record.present !== true && record.present !== false);
        const recordedIds = new Set(records.map(record => record.studentId));
        const studentsWithoutRecord = students.filter(student => !recordedIds.has(student.id) && wasEnrolled(student, session.date));
        const probableAbsent = records.length ? studentsWithoutRecord : [];
        const visibleName = name => !searchTerm || name.toLocaleLowerCase('pt-BR').includes(searchTerm);
        const nameList = (title, list, empty, color) => <div><h4 className={`mb-1 text-sm font-semibold ${color}`}>{title} <span className="font-normal text-gray-500">({list.length})</span></h4>{list.length ? <ul className="flex flex-wrap gap-2">{list.filter(item => visibleName(item.studentName || item.name)).map(item => <li key={item.studentId || item.id} className="rounded-full bg-white px-3 py-1 text-sm text-gray-700 shadow-sm dark:bg-gray-700 dark:text-gray-100">{item.studentName || item.name}</li>)}</ul> : <p className="text-sm text-gray-500">{empty}</p>}</div>;
        return <details key={session.date} className="surface group overflow-hidden"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"><CalendarDays size={19}/></span><div><p className="font-semibold">{session.lessonNumber <= 13 ? `Aula ${session.lessonNumber}` : 'Aula extra'} · {dateLabel(session.date)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{records.length} aluno(s) com registro</p></div></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">{present.length} presentes</span><span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">{absent.length} faltas confirmadas</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{probableAbsent.length} prováveis</span></div></summary><div className="grid gap-4 border-t border-gray-100 p-4 dark:border-gray-700 md:grid-cols-2">{nameList('Presentes', present, 'Nenhuma presença registrada.', 'text-emerald-700 dark:text-emerald-300')}{nameList('Faltas confirmadas', absent, 'Nenhuma falta marcada como ausente.', 'text-rose-700 dark:text-rose-300')}{nameList('Faltas prováveis (sem registro)', probableAbsent, records.length ? 'Nenhuma.' : 'Chamada sem registros; não inferimos faltas.', 'text-amber-700 dark:text-amber-300')}{nameList('Registro sem status', pendingRecords, 'Nenhum registro pendente.', 'text-gray-600 dark:text-gray-300')}</div></details>;
      })}</div></section>
      <section className="surface overflow-hidden"><div className="border-b border-gray-100 p-4 dark:border-gray-700"><h2 className="font-semibold">Resumo por aluno</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{visibleStats.length} aluno(s) · faltas prováveis aparecem separadas das confirmadas.</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left dark:bg-gray-700"><tr><th className="px-4 py-3">Aluno</th><th className="px-4 py-3 text-center">Presenças</th><th className="px-4 py-3 text-center">Faltas confirmadas</th><th className="px-4 py-3 text-center">Faltas prováveis</th><th className="px-4 py-3">Frequência</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{visibleStats.slice().sort((a, b) => b.present - a.present || a.name.localeCompare(b.name, 'pt-BR')).map(item => <tr key={item.id}><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-center text-emerald-700 dark:text-emerald-300">{item.present}</td><td className="px-4 py-3 text-center text-rose-700 dark:text-rose-300">{item.absent}</td><td className="px-4 py-3 text-center text-amber-700 dark:text-amber-300">{item.probableAbsent}</td><td className="px-4 py-3">{item.marked ? <div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${item.rate}%` }}/></div><span>{item.rate.toFixed(1)}%</span></div> : <span className="text-gray-400">Sem chamada</span>}</td></tr>)}</tbody></table>{!visibleStats.length && <p className="p-6 text-center text-sm text-gray-500">Nenhum aluno corresponde à busca.</p>}</div></section>
    </>}
  </section>;
}
