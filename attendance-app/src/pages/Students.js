import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = useCallback(async e => {
    e.preventDefault();
    if (!name) return;
    await addDoc(collection(db, 'students'), { name, createdAt: new Date() });
    setName('');
  }, [name]);

  // Proteção contra exclusão acidental
  const handleDelete = useCallback(async (id, studentName) => {
    const confirm = window.confirm(`Tem certeza que deseja excluir o aluno "${studentName}"? Esta ação não pode ser desfeita.`);
    if (!confirm) return;
    await deleteDoc(doc(db, 'students', id));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">Cadastro de Alunos</h2>
      <form onSubmit={handleAdd} className="max-w-md mx-auto flex space-x-2 mb-6">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome do aluno"
          className="flex-1 px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring"
        />
        <button
          type="submit"
          className="px-4 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Adicionar
        </button>
      </form>

      <ul className="max-w-md mx-auto divide-y divide-gray-200 dark:divide-gray-700">
        {students.map(s => (
          <li key={s.id} className="py-2 flex justify-between items-center">
            <span className="text-gray-800 dark:text-gray-100">{s.name}</span>
            <button
              onClick={() => handleDelete(s.id, s.name)}
              className="text-red-600 hover:text-red-800"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}