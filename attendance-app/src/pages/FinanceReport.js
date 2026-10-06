import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { format, startOfWeek, startOfMonth, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const toLocalDate = value => typeof value === 'string' ? parseISO(value) : value?.toDate ? value.toDate() : new Date(value);
const toCents = value => Math.round(Number(value || 0) * 100);
const money = cents => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinanceReport() {
  const [entries, setEntries] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [periodValue, setPeriodValue] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'cashEntries')),
      getDocs(collection(db, 'cashEntriesHistory'))
    ]).then(([entriesSnap, historySnap]) => {
      setEntries(entriesSnap.docs.map(d => {
        const value = d.data();
        return { ...value, id: d.id, date: toLocalDate(value.date || d.id), type: 'entrada' };
      }));
      setHistory(historySnap.docs.map(d => {
        const value = d.data();
        return { ...value, id: d.id, date: toLocalDate(value.date) };
      }));
    }).catch(() => setLoadError('Não foi possível carregar os dados financeiros. Atualize a página e tente novamente.'))
      .finally(() => setLoading(false));
  }, []);

  const monthOptions = useMemo(() => [...new Set(entries.map(entry => format(startOfMonth(entry.date), 'yyyy-MM')))].sort(), [entries]);
  const yearOptions = useMemo(() => [...new Set(entries.map(entry => entry.date.getFullYear()))].sort(), [entries]);
  const allItems = useMemo(() => [...entries, ...history.filter(item => item.type === 'retirada')], [entries, history]);

  const filteredItems = useMemo(() => {
    let filtered = allItems;
    if (period === 'month' && periodValue) filtered = filtered.filter(item => format(startOfMonth(item.date), 'yyyy-MM') === periodValue);
    if (period === 'year' && periodValue) filtered = filtered.filter(item => String(item.date.getFullYear()) === periodValue);
    if (dateStart || dateEnd) {
      const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(0);
      const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date(8640000000000000);
      filtered = filtered.filter(item => item.date >= start && item.date <= end);
    }
    if (typeFilter !== 'all') filtered = filtered.filter(item => item.type === typeFilter);
    if (search.trim()) filtered = filtered.filter(item => (item.reason || '').toLowerCase().includes(search.trim().toLowerCase()));
    return filtered.slice().sort((a, b) => b.date - a.date);
  }, [allItems, period, periodValue, dateStart, dateEnd, typeFilter, search]);

  // Confere se o acumulado de entradas por data coincide com seus lançamentos detalhados.
  const reconciliationIssues = useMemo(() => {
    const aggregateByDate = new Map(entries.map(item => [item.id, toCents(item.amount)]));
    const historyByDate = new Map();
    history.filter(item => item.type === 'entrada').forEach(item => {
      const key = format(item.date, 'yyyy-MM-dd');
      historyByDate.set(key, (historyByDate.get(key) || 0) + toCents(item.amount));
    });
    const dates = new Set([...aggregateByDate.keys(), ...historyByDate.keys()]);
    return [...dates].map(date => ({ date, aggregateCents: aggregateByDate.get(date) || 0, historyCents: historyByDate.get(date) || 0 }))
      .filter(item => item.aggregateCents !== item.historyCents).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, history]);

  const { totalCents, totalWithdrawalsCents, byWeek, byMonth } = useMemo(() => {
    let totalCents = 0;
    let totalWithdrawalsCents = 0;
    const weeks = {};
    const months = {};
    filteredItems.forEach(item => {
      const cents = toCents(item.amount);
      if (item.type === 'retirada') totalWithdrawalsCents += cents;
      else {
        totalCents += cents;
        const week = format(startOfWeek(item.date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        const month = format(startOfMonth(item.date), 'yyyy-MM');
        weeks[week] = (weeks[week] || 0) + cents;
        months[month] = (months[month] || 0) + cents;
      }
    });
    return { totalCents, totalWithdrawalsCents, byWeek: weeks, byMonth: months };
  }, [filteredItems]);
  const finalBalanceCents = totalCents - totalWithdrawalsCents;

  const chartData = useMemo(() => {
    const months = {};
    filteredItems.forEach(item => {
      const month = format(startOfMonth(item.date), 'yyyy-MM');
      if (!months[month]) months[month] = { month, entradas: 0, retiradas: 0 };
      if (item.type === 'retirada') months[month].retiradas += toCents(item.amount) / 100;
      else months[month].entradas += toCents(item.amount) / 100;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredItems]);

  function downloadFile(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
  }
  function handleExportCSV() {
    const rows = [['Tipo', 'Data', 'Valor', 'Motivo'], ...filteredItems.map(item => [item.type === 'retirada' ? 'Retirada' : 'Entrada', format(item.date, 'yyyy-MM-dd'), (toCents(item.amount) / 100).toFixed(2), item.reason || ''])];
    downloadFile('\uFEFF' + rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv;charset=utf-8', 'financeiro.csv');
  }
  function handleDownload() {
    const content = ['Relatório Financeiro', `Saldo do filtro: R$ ${money(finalBalanceCents)}`, `(Entradas: R$ ${money(totalCents)} - Retiradas: R$ ${money(totalWithdrawalsCents)})`, '', 'Entradas por mês:', ...Object.entries(byMonth).map(([month, cents]) => `${month}: R$ ${money(cents)}`), '', 'Entradas por semana:', ...Object.entries(byWeek).map(([week, cents]) => `${week}: R$ ${money(cents)}`), '', 'Lançamentos detalhados:', ...filteredItems.map(item => `${format(item.date, 'yyyy-MM-dd')}: ${item.type === 'retirada' ? '-' : ''}R$ ${money(toCents(item.amount))} - ${item.reason || ''}`)].join('\n');
    downloadFile(content, 'text/plain;charset=utf-8', 'relatorio-financeiro.txt');
  }

  if (loading) return <div role="status">Carregando relatório financeiro…</div>;

  return <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-6 rounded shadow">
    <h2 className="text-2xl font-bold mb-4">Relatório Financeiro</h2>
    {loadError && <p role="alert" className="mb-4 rounded bg-red-100 p-3 text-red-800">{loadError}</p>}
    {reconciliationIssues.length > 0 && <section role="status" className="mb-5 rounded border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
      <h3 className="font-semibold">Há datas que precisam de conferência</h3>
      <p className="mt-1 text-sm">O total acumulado e a soma do histórico não batem em {reconciliationIssues.length} data(s). Valores antigos não foram alterados automaticamente.</p>
      <ul className="mt-2 space-y-1 text-sm">{reconciliationIssues.slice(0, 8).map(item => <li key={item.date}>{format(parseISO(item.date), 'dd/MM/yyyy')}: acumulado R$ {money(item.aggregateCents)} · histórico R$ {money(item.historyCents)}</li>)}</ul>
      {reconciliationIssues.length > 8 && <p className="mt-1 text-xs">Mais {reconciliationIssues.length - 8} data(s) com diferença.</p>}
    </section>}
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <span><b>Saldo do filtro:</b> <span className={finalBalanceCents < 0 ? 'text-red-600' : 'text-green-700'}>R$ {money(finalBalanceCents)}</span></span>
      <span><b>Entradas:</b> R$ {money(totalCents)}</span><span><b>Retiradas:</b> R$ {money(totalWithdrawalsCents)}</span>
    </div>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label>Período: <select value={period} onChange={e => { setPeriod(e.target.value); setPeriodValue(''); }} className="ml-1 border rounded px-2 py-1"><option value="all">Todos</option><option value="month">Por mês</option><option value="year">Por ano</option></select></label>
      {period === 'month' && <select value={periodValue} onChange={e => setPeriodValue(e.target.value)} className="border rounded px-2 py-1"><option value="">Selecione mês</option>{monthOptions.map(month => <option key={month} value={month}>{month}</option>)}</select>}
      {period === 'year' && <select value={periodValue} onChange={e => setPeriodValue(e.target.value)} className="border rounded px-2 py-1"><option value="">Selecione ano</option>{yearOptions.map(year => <option key={year} value={year}>{year}</option>)}</select>}
      <label className="sr-only" htmlFor="finance-start">Data inicial</label><input id="finance-start" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="border rounded px-2 py-1" />
      <label className="sr-only" htmlFor="finance-end">Data final</label><input id="finance-end" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="border rounded px-2 py-1" />
      <select aria-label="Filtrar tipo de lançamento" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded px-2 py-1"><option value="all">Entradas e retiradas</option><option value="entrada">Somente entradas</option><option value="retirada">Somente retiradas</option></select>
      <input aria-label="Buscar motivo" type="text" placeholder="Buscar motivo…" value={search} onChange={e => setSearch(e.target.value)} className="border rounded px-2 py-1" />
      <button onClick={handleExportCSV} className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800" disabled={!filteredItems.length}>Exportar CSV</button>
      <button onClick={handleDownload} className="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-800" disabled={!filteredItems.length}>Baixar relatório TXT</button>
    </div>
    <h3 className="font-semibold mt-4">Entradas e retiradas por mês</h3>
    <div style={{ width: '100%', height: 240 }}><ResponsiveContainer width="100%" height={220}><BarChart data={chartData}><XAxis dataKey="month"/><YAxis/><Tooltip formatter={value => `R$ ${Number(value).toFixed(2)}`}/><Legend/><Bar dataKey="entradas" fill="#16a34a" name="Entradas"/><Bar dataKey="retiradas" fill="#dc2626" name="Retiradas"/></BarChart></ResponsiveContainer></div>
    <h3 className="font-semibold mt-4">Entradas por mês</h3><ul>{Object.entries(byMonth).map(([month, cents]) => <li key={month}>{month}: <b>R$ {money(cents)}</b></li>)}</ul>
    <h3 className="font-semibold mt-4">Entradas por semana</h3><ul>{Object.entries(byWeek).map(([week, cents]) => <li key={week}>{format(parseISO(week), 'dd/MM/yyyy')}: <b>R$ {money(cents)}</b></li>)}</ul>
    <h3 className="font-semibold mt-4">Histórico detalhado</h3>
    <div className="overflow-x-auto"><table className="min-w-full bg-white dark:bg-gray-800 rounded shadow overflow-hidden text-sm"><thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="px-2 py-2 text-left">Tipo</th><th className="px-2 py-2 text-left">Data</th><th className="px-2 py-2 text-right">Valor</th><th className="px-2 py-2 text-left">Motivo</th></tr></thead><tbody>{filteredItems.map(item => <tr key={item.id} className="border-b dark:border-gray-700"><td className={`px-2 py-2 ${item.type === 'retirada' ? 'text-red-600' : 'text-green-700'}`}>{item.type === 'retirada' ? 'Retirada' : 'Entrada'}</td><td className="px-2 py-2">{format(item.date, 'dd/MM/yyyy')}</td><td className={`px-2 py-2 text-right font-bold ${item.type === 'retirada' ? 'text-red-600' : 'text-green-700'}`}>R$ {money(toCents(item.amount))}</td><td className="px-2 py-2">{item.reason || '-'}</td></tr>)}</tbody></table>
      {!filteredItems.length && <p className="py-6 text-center text-gray-500">Nenhum lançamento encontrado para os filtros selecionados.</p>}
    </div>
  </div>;
}
