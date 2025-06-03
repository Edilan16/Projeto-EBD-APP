import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, onSnapshot, addDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { startOfWeek, format } from 'date-fns';

export default function FinanceEntry() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const sunday = startOfWeek(new Date(), { weekStartsOn: 0 });
    return format(sunday, 'yyyy-MM-dd');
  });
  const [amount, setAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Carrega histórico de lançamentos e retiradas
  useEffect(() => {
    const q = query(collection(db, 'cashEntriesHistory'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(data);
    });
    return () => unsub();
  }, []);

  // Carrega valor caso já exista lançamento na data selecionada
  useEffect(() => {
    const ref = doc(db, 'cashEntries', selectedDate);
    getDoc(ref).then(docSnap => {
      if (docSnap.exists()) {
        setAmount(docSnap.data().amount.toString());
      } else {
        setAmount('');
      }
    });
  }, [selectedDate]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  // Lançamento de entrada (agora soma ao valor existente)
  const handleSave = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      setError('Digite um valor válido e maior que zero.');
      setLoading(false);
      return;
    }
    try {
      const ref = doc(db, 'cashEntries', selectedDate);
      const docSnap = await getDoc(ref);
      let current = 0;
      if (docSnap.exists()) {
        current = docSnap.data().amount || 0;
      }
      const newAmount = current + num;

      await setDoc(ref, {
        date: selectedDate,
        amount: newAmount,
        createdAt: new Date()
      });
      await addDoc(collection(db, 'cashEntriesHistory'), {
        type: 'entrada',
        date: selectedDate,
        amount: num,
        reason: 'Lançamento de entrada',
        createdAt: new Date()
      });
      showToast('Entrada salva com sucesso!');
    } catch (err) {
      setError('Erro ao salvar entrada.');
    }
    setLoading(false);
  };

  // Exclusão de lançamento (apenas se criado há menos de 5 minutos)
  const handleDeleteEntry = async (entry) => {
    const createdAt = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
    const canDelete = (Date.now() - createdAt.getTime()) < 5 * 60 * 1000; // 5 minutos
    if (!canDelete) {
      showToast('Só é possível excluir lançamentos feitos nos últimos 5 minutos.');
      return;
    }
    const confirm = window.confirm('Tem certeza que deseja excluir este lançamento?');
    if (!confirm) return;

    try {
      // Se for uma entrada, subtrai o valor do cashEntries (não remove mais o doc inteiro)
      if (entry.type === 'entrada') {
        const ref = doc(db, 'cashEntries', entry.date);
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
          let current = docSnap.data().amount || 0;
          let newAmount = current - entry.amount;
          if (newAmount <= 0) {
            await deleteDoc(ref);
          } else {
            await setDoc(ref, {
              date: entry.date,
              amount: newAmount,
              createdAt: docSnap.data().createdAt || new Date()
            });
          }
        }
      }
      await deleteDoc(doc(db, 'cashEntriesHistory', entry.id));
      showToast('Lançamento excluído!');
    } catch (err) {
      setError('Erro ao excluir lançamento.');
    }
  };

  // Lançamento de retirada
  const handleWithdraw = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const num = parseFloat(withdrawAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      setError('Digite um valor válido e maior que zero para retirada.');
      setLoading(false);
      return;
    }
    if (!withdrawReason.trim()) {
      setError('Informe o motivo da retirada.');
      setLoading(false);
      return;
    }
    if (!window.confirm(`Confirma registrar retirada de R$ ${num.toFixed(2)}?`)) {
      setLoading(false);
      return;
    }
    try {
      await addDoc(collection(db, 'cashEntriesHistory'), {
        type: 'retirada',
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: num,
        reason: withdrawReason,
        createdAt: new Date()
      });
      setWithdrawAmount('');
      setWithdrawReason('');
      showToast('Retirada registrada!');
    } catch (err) {
      setError('Erro ao registrar retirada.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold dark:text-gray-100">Lançar Caixa Semanal</h2>

      {toast && (
        <div className="px-4 py-2 bg-green-100 text-green-800 rounded shadow text-center transition">
          {toast}
        </div>
      )}
      {error && (
        <div className="px-4 py-2 bg-red-100 text-red-800 rounded shadow text-center transition">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col space-y-4">
        <div>
          <label className="block mb-1 dark:text-gray-300">Domingo da Semana</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            required
          />
        </div>
        <div>
          <label className="block mb-1 dark:text-gray-300">Valor (R$)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            required
          />
        </div>
        <button
          type="submit"
          className="self-end px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar Entrada'}
        </button>
      </form>

      <form onSubmit={handleWithdraw} className="flex flex-col space-y-4 border-t pt-6 mt-6">
        <h3 className="font-medium dark:text-gray-100">Registrar Retirada</h3>
        <div>
          <label className="block mb-1 dark:text-gray-300">Valor da Retirada (R$)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={withdrawAmount}
            onChange={e => setWithdrawAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            required
          />
        </div>
        <div>
          <label className="block mb-1 dark:text-gray-300">Motivo da Retirada</label>
          <input
            type="text"
            value={withdrawReason}
            onChange={e => setWithdrawReason(e.target.value)}
            placeholder="Ex: Compra de material"
            className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            required
          />
        </div>
        <button
          type="submit"
          className="self-end px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          disabled={loading}
        >
          {loading ? 'Registrando...' : 'Registrar Retirada'}
        </button>
      </form>

      <div>
        <h3 className="font-medium dark:text-gray-100">Histórico</h3>
        <ul className="mt-2 space-y-1">
          {history.map(entry => {
            const createdAt = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
            const canDelete = (Date.now() - createdAt.getTime()) < 5 * 60 * 1000; // 5 minutos
            return (
              <li key={entry.id} className="flex justify-between items-center">
                <span className="dark:text-gray-200">
                  {entry.date} - {entry.type === 'retirada' ? 'Retirada' : 'Entrada'}
                  {entry.reason ? ` (${entry.reason})` : ''}
                </span>
                <span className={entry.type === 'retirada' ? "text-red-600" : "text-green-600"}>
                  R$ {entry.amount.toFixed(2)}
                </span>
                {canDelete && (
                  <button
                    className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded"
                    onClick={() => handleDeleteEntry(entry)}
                  >
                    Excluir
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}