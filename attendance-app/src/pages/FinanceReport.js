import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { format, startOfWeek, startOfMonth, isWithinInterval, parseISO } from 'date-fns';
// Para gráfico (opcional, remova se não quiser)
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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

  // Carrega entradas e retiradas
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDocs(collection(db, 'cashEntries')),
      getDocs(collection(db, 'cashEntriesHistory'))
    ]).then(([entriesSnap, historySnap]) => {
      setEntries(
        entriesSnap.docs.map(d => {
          const entry = d.data();
          entry.date = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
          entry.type = 'entrada';
          return entry;
        })
      );
      setHistory(
        historySnap.docs.map(d => {
          const entry = d.data();
          entry.date = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
          return entry;
        })
      );
      setLoading(false);
    });
  }, []);

  // Opções de mês e ano para filtro
  const monthOptions = useMemo(() => {
    const setM = new Set();
    entries.forEach(entry => {
      setM.add(format(startOfMonth(entry.date), 'yyyy-MM'));
    });
    return [...setM].sort();
  }, [entries]);

  const yearOptions = useMemo(() => {
    const setY = new Set();
    entries.forEach(entry => {
      setY.add(entry.date.getFullYear());
    });
    return [...setY].sort();
  }, [entries]);

  // Filtra lançamentos por período, tipo, busca e intervalo de datas
  const allItems = useMemo(() => [
    ...entries,
    ...history.filter(h => h.type === 'retirada')
  ], [entries, history]);

  const filteredItems = useMemo(() => {
    let filtered = allItems;
    if (period === 'month' && periodValue) {
      filtered = filtered.filter(e => format(startOfMonth(e.date), 'yyyy-MM') === periodValue);
    }
    if (period === 'year' && periodValue) {
      filtered = filtered.filter(e => e.date.getFullYear().toString() === periodValue);
    }
    if (dateStart && dateEnd) {
      const start = parseISO(dateStart);
      const end = parseISO(dateEnd);
      filtered = filtered.filter(e =>
        isWithinInterval(e.date, { start, end })
      );
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter(e => (e.type || 'entrada') === typeFilter);
    }
    if (search.trim()) {
      filtered = filtered.filter(e =>
        (e.reason || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered.sort((a, b) => b.date - a.date);
  }, [allItems, period, periodValue, dateStart, dateEnd, typeFilter, search]);

  // Agrupamento por semana e mês (apenas ENTRADAS filtradas)
  const { total, byWeek, byMonth } = useMemo(() => {
    let total = 0;
    const weeks = {};
    const months = {};
    filteredItems.forEach(entry => {
      if ((entry.type || 'entrada') === 'entrada') {
        total += entry.amount;
        const week = format(startOfWeek(entry.date), 'yyyy-MM-dd');
        const month = format(startOfMonth(entry.date), 'yyyy-MM');
        weeks[week] = (weeks[week] || 0) + entry.amount;
        months[month] = (months[month] || 0) + entry.amount;
      }
    });
    return { total, byWeek: weeks, byMonth: months };
  }, [filteredItems]);

  // Soma total de retiradas filtradas
  const totalWithdrawals = useMemo(
    () => filteredItems.filter(i => (i.type || 'entrada') === 'retirada').reduce((sum, w) => sum + (w.amount || 0), 0),
    [filteredItems]
  );

  // Saldo final: entradas - retiradas
  const finalBalance = total - totalWithdrawals;

  // Exportação CSV
  function handleExportCSV() {
    const header = ['Tipo', 'Data', 'Valor', 'Motivo'];
    const rows = filteredItems.map(e => [
      (e.type === 'retirada' ? 'Retirada' : 'Entrada'),
      format(e.date, 'yyyy-MM-dd'),
      e.amount.toFixed(2),
      e.reason || ''
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(f => `"${(f || '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const csvContent = "\uFEFF" + csv;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financeiro.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Exportação TXT (relatório simples)
  function handleDownload() {
    const report = [
      'Relatório Financeiro',
      `Saldo total: R$ ${finalBalance.toFixed(2)}`,
      `(Entradas: R$ ${total.toFixed(2)} - Retiradas: R$ ${totalWithdrawals.toFixed(2)})`,
      '',
      'Entradas por mês:',
      ...Object.entries(byMonth).map(([month, value]) => `${month}: R$ ${value.toFixed(2)}`),
      '',
      'Entradas por semana:',
      ...Object.entries(byWeek).map(([week, value]) => `${week}: R$ ${value.toFixed(2)}`),
      '',
      'Lançamentos detalhados:',
      ...filteredItems.map(e =>
        `${format(e.date, 'yyyy-MM-dd')}: ${e.type === 'retirada' ? '-' : ''}R$ ${e.amount.toFixed(2)} - ${e.reason || ''}`
      ),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-financeiro.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Dados para gráfico (opcional)
  const chartData = useMemo(() => {
    // Agrupa por mês, soma entradas e retiradas
    const months = {};
    filteredItems.forEach(e => {
      const m = format(startOfMonth(e.date), 'yyyy-MM');
      if (!months[m]) months[m] = { month: m, entradas: 0, retiradas: 0 };
      if ((e.type || 'entrada') === 'entrada') months[m].entradas += e.amount;
      else months[m].retiradas += e.amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredItems]);

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Relatório Financeiro</h2>

      {/* Resumo rápido */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <span><b>Saldo total:</b> <span className={finalBalance < 0 ? 'text-red-600' : 'text-green-700'}>R$ {finalBalance.toFixed(2)}</span></span>
        <span><b>Total de entradas:</b> R$ {total.toFixed(2)}</span>
        <span><b>Total de retiradas:</b> R$ {totalWithdrawals.toFixed(2)}</span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <label>
          Período:
          <select
            value={period}
            onChange={e => { setPeriod(e.target.value); setPeriodValue(''); }}
            className="ml-2"
          >
            <option value="all">Todos</option>
            <option value="month">Por mês</option>
            <option value="year">Por ano</option>
          </select>
        </label>
        {period === 'month' && (
          <select
            value={periodValue}
            onChange={e => setPeriodValue(e.target.value)}
          >
            <option value="">Selecione mês</option>
            {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {period === 'year' && (
          <select
            value={periodValue}
            onChange={e => setPeriodValue(e.target.value)}
          >
            <option value="">Selecione ano</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <input
          type="date"
          value={dateStart}
          onChange={e => setDateStart(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Data início"
        />
        <input
          type="date"
          value={dateEnd}
          onChange={e => setDateEnd(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Data fim"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="all">Entradas e Retiradas</option>
          <option value="entrada">Somente Entradas</option>
          <option value="retirada">Somente Retiradas</option>
        </select>
        <input
          type="text"
          placeholder="Buscar motivo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-2 py-1 ml-2"
        />
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={!filteredItems.length}
        >
          Exportar CSV
        </button>
        <button
          onClick={handleDownload}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={!filteredItems.length}
        >
          Baixar relatório TXT
        </button>
      </div>

      {/* Gráfico de barras por mês */}
      <h3 className="font-semibold mt-4">Gráfico de Entradas e Retiradas por mês</h3>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={v => `R$ ${v.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="entradas" fill="#16a34a" name="Entradas" />
            <Bar dataKey="retiradas" fill="#dc2626" name="Retiradas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Entradas por mês */}
      <h3 className="font-semibold mt-4">Entradas por mês</h3>
      <ul>
        {Object.entries(byMonth).map(([month, value]) => (
          <li key={month}>{month}: <b>R$ {value.toFixed(2)}</b></li>
        ))}
      </ul>
      {/* Entradas por semana */}
      <h3 className="font-semibold mt-4">Entradas por semana</h3>
      <ul>
        {Object.entries(byWeek).map(([week, value]) => (
          <li key={week}>{week}: <b>R$ {value.toFixed(2)}</b></li>
        ))}
      </ul>
      {/* Lançamentos detalhados */}
      <h3 className="font-semibold mt-4">Histórico detalhado</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow overflow-hidden text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Tipo</th>
              <th className="px-2 py-1 text-left">Data</th>
              <th className="px-2 py-1 text-right">Valor</th>
              <th className="px-2 py-1 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className={`px-2 py-1 ${item.type === 'retirada' ? 'text-red-600' : 'text-green-700'}`}>
                  {item.type === 'retirada' ? 'Retirada' : 'Entrada'}
                </td>
                <td className="px-2 py-1">{format(item.date, 'yyyy-MM-dd')}</td>
                <td className={`px-2 py-1 text-right font-bold ${item.type === 'retirada' ? 'text-red-600' : 'text-green-700'}`}>
                  R$ {item.amount.toFixed(2)}
                </td>
                <td className="px-2 py-1">{item.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}