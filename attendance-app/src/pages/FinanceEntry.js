import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, collection, onSnapshot, query, orderBy, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { startOfWeek, format, parseISO } from 'date-fns';

const toCents = value => Math.round(Number(value || 0) * 100);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const localDate = value => typeof value === 'string' ? parseISO(value) : value?.toDate ? value.toDate() : new Date(value);

export default function FinanceEntry() {
  const [selectedDate, setSelectedDate] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [history, setHistory] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'cashEntriesHistory'), orderBy('date', 'desc'));
    return onSnapshot(q, snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setError('Não foi possível carregar o histórico.'));
  }, []);

  useEffect(() => {
    const ref = doc(db, 'cashEntries', selectedDate);
    return onSnapshot(ref, snap => {
      const current = snap.exists() ? Number(snap.data().amount || 0) : 0;
      setWeeklyTotal(Number.isFinite(current) ? current : 0);
    }, () => setError('Não foi possível carregar o total da semana.'));
  }, [selectedDate]);

  function showToast(msg) { setToast(msg); window.setTimeout(() => setToast(''), 2500); }

  const handleSave = async e => {
    e.preventDefault();
    setError('');
    const value = Number(String(amount).replace(',', '.'));
    const cents = toCents(value);
    if (!Number.isFinite(value) || cents <= 0) { setError('Digite um valor válido e maior que zero.'); return; }
    setLoading(true);
    try {
      const aggregateRef = doc(db, 'cashEntries', selectedDate);
      const historyRef = doc(collection(db, 'cashEntriesHistory'));
      await runTransaction(db, async transaction => {
        const currentSnap = await transaction.get(aggregateRef);
        const currentAmount = currentSnap.exists() ? Number(currentSnap.data().amount || 0) : 0;
        const currentCents = toCents(currentAmount);
        transaction.set(aggregateRef, {
          date: selectedDate,
          amount: (currentCents + cents) / 100,
          createdAt: currentSnap.exists() ? (currentSnap.data().createdAt || serverTimestamp()) : serverTimestamp()
        });
        transaction.set(historyRef, {
          type: 'entrada', date: selectedDate, amount: cents / 100,
          reason: 'Lançamento de entrada', createdAt: serverTimestamp()
        });
      });
      setAmount('');
      showToast(`Entrada de ${money(cents / 100)} registrada.`);
    } catch (err) {
      setError('Não foi possível salvar a entrada. Nenhuma parte do lançamento foi confirmada; tente novamente.');
    } finally { setLoading(false); }
  };

  const handleDeleteEntry = async entry => {
    const createdAt = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || Date.now() - createdAt.getTime() >= 5 * 60 * 1000) {
      showToast('Só é possível excluir lançamentos feitos nos últimos 5 minutos.'); return;
    }
    if (!window.confirm('Tem certeza que deseja excluir este lançamento?')) return;
    setError(''); setLoading(true);
    try {
      const historyRef = doc(db, 'cashEntriesHistory', entry.id);
      if (entry.type === 'entrada') {
        const aggregateRef = doc(db, 'cashEntries', entry.date);
        await runTransaction(db, async transaction => {
          const historySnap = await transaction.get(historyRef);
          if (!historySnap.exists()) return;
          const aggregateSnap = await transaction.get(aggregateRef);
          if (!aggregateSnap.exists()) throw new Error('O total acumulado desta data não foi encontrado.');
          const currentCents = toCents(aggregateSnap.data().amount);
          const entryCents = toCents(historySnap.data().amount);
          if (currentCents < entryCents) throw new Error('O total acumulado é menor que este lançamento.');
          const newCents = currentCents - entryCents;
          if (newCents === 0) transaction.delete(aggregateRef);
          else transaction.set(aggregateRef, { ...aggregateSnap.data(), amount: newCents / 100 });
          transaction.delete(historyRef);
        });
      } else {
        await runTransaction(db, async transaction => {
          const historySnap = await transaction.get(historyRef);
          if (historySnap.exists()) transaction.delete(historyRef);
        });
      }
      showToast('Lançamento excluído.');
    } catch (err) {
      setError(err.message === 'O total acumulado desta data não foi encontrado.' || err.message === 'O total acumulado é menor que este lançamento.' ? `${err.message} O registro foi mantido para conferência.` : 'Não foi possível excluir o lançamento. O registro foi mantido.');
    } finally { setLoading(false); }
  };

  const handleWithdraw = async e => {
    e.preventDefault(); setError('');
    const value = Number(String(withdrawAmount).replace(',', '.'));
    const cents = toCents(value);
    if (!Number.isFinite(value) || cents <= 0) { setError('Digite um valor válido e maior que zero para retirada.'); return; }
    if (!withdrawReason.trim()) { setError('Informe o motivo da retirada.'); return; }
    if (!window.confirm(`Confirma registrar retirada de ${money(cents / 100)}?`)) return;
    setLoading(true);
    try {
      const historyRef = doc(collection(db, 'cashEntriesHistory'));
      await runTransaction(db, async transaction => {
        transaction.set(historyRef, { type: 'retirada', date: format(new Date(), 'yyyy-MM-dd'), amount: cents / 100, reason: withdrawReason.trim(), createdAt: serverTimestamp() });
      });
      setWithdrawAmount(''); setWithdrawReason(''); showToast('Retirada registrada.');
    } catch (err) { setError('Não foi possível registrar a retirada. Tente novamente.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold dark:text-gray-100">Lançar Caixa Semanal</h2>
      {toast && <div role="status" className="px-4 py-2 bg-green-100 text-green-800 rounded shadow text-center">{toast}</div>}
      {error && <div role="alert" className="px-4 py-2 bg-red-100 text-red-800 rounded shadow text-center">{error}</div>}

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800" aria-live="polite">
        <p className="text-sm text-gray-600 dark:text-gray-300">Total de entradas em {format(parseISO(selectedDate), 'dd/MM/yyyy')}</p>
        <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">{money(weeklyTotal)}</p>
      </section>
      <form onSubmit={handleSave} className="flex flex-col space-y-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800">
        <h3 className="font-medium dark:text-gray-100">Adicionar entrada</h3>
        <div><label className="block mb-1 dark:text-gray-300">Data da semana</label><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" required /></div>
        <div><label className="block mb-1 dark:text-gray-300">Valor desta entrada (R$)</label><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" required /></div>
        <button type="submit" className="self-end px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 transition" disabled={loading}>{loading ? 'Salvando…' : 'Adicionar entrada'}</button>
      </form>
      <form onSubmit={handleWithdraw} className="flex flex-col space-y-4 rounded-lg border-t bg-white p-5 shadow dark:bg-gray-800">
        <h3 className="font-medium dark:text-gray-100">Registrar retirada</h3>
        <div><label className="block mb-1 dark:text-gray-300">Valor da retirada (R$)</label><input type="number" min="0.01" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0,00" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" required /></div>
        <div><label className="block mb-1 dark:text-gray-300">Motivo</label><input type="text" value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} placeholder="Ex.: compra de material" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" required /></div>
        <button type="submit" className="self-end px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition" disabled={loading}>{loading ? 'Registrando…' : 'Registrar retirada'}</button>
      </form>
      <section><h3 className="font-medium dark:text-gray-100">Histórico</h3><ul className="mt-2 space-y-2">{history.map(entry => {
        const createdAt = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
        const canDelete = Number.isFinite(createdAt.getTime()) && Date.now() - createdAt.getTime() < 5 * 60 * 1000;
        return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-3 shadow-sm dark:bg-gray-800"><span className="min-w-0 text-sm dark:text-gray-200">{format(localDate(entry.date), 'dd/MM/yyyy')} · {entry.type === 'retirada' ? 'Retirada' : 'Entrada'}{entry.reason ? ` (${entry.reason})` : ''}</span><span className={entry.type === 'retirada' ? 'text-red-600' : 'text-green-600'}>{money(entry.amount)}</span>{canDelete && <button disabled={loading} className="px-2 py-1 text-xs bg-red-500 text-white rounded disabled:opacity-50" onClick={() => handleDeleteEntry(entry)}>Excluir</button>}</li>;
      })}</ul></section>
    </div>
  );
}
