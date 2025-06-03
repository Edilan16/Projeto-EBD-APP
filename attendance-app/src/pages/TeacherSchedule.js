import React, { useState, useEffect } from 'react';

export default function TeacherSchedule() {
  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('teacherSchedules');
    return saved ? JSON.parse(saved) : [];
  });
  const [form, setForm] = useState({
    teacher: '',
    date: '',
    lesson: '',
    quarter: '',
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    localStorage.setItem('teacherSchedules', JSON.stringify(schedules));
  }, [schedules]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.teacher.trim()) {
      showToast('Nome do professor é obrigatório!');
      return;
    }
    if (!/^\d+$/.test(form.lesson)) {
      showToast('Número da lição deve ser um número!');
      return;
    }
    const exists = schedules.some(
      (item, idx) =>
        item.date === form.date && idx !== editingIndex
    );
    if (exists) {
      showToast('Já existe uma escala para esta data!');
      return;
    }
    if (editingIndex !== null) {
      const updated = [...schedules];
      updated[editingIndex] = form;
      setSchedules(updated);
      setEditingIndex(null);
      showToast('Escala alterada!');
    } else {
      setSchedules([...schedules, form]);
      showToast('Escala adicionada!');
    }
    setForm({ teacher: '', date: '', lesson: '', quarter: '' });
  }

  function handleEdit(idx) {
    setForm(schedules[idx]);
    setEditingIndex(idx);
  }

  function handleCancel() {
    setForm({ teacher: '', date: '', lesson: '', quarter: '' });
    setEditingIndex(null);
  }

  function handleDelete(idx) {
    const item = schedules[idx];
    if (
      window.confirm(
        `Tem certeza que deseja excluir a escala de "${item.teacher}" em ${item.date}?`
      )
    ) {
      setSchedules(schedules => schedules.filter((_, i) => i !== idx));
      showToast('Escala excluída!');
      if (editingIndex === idx) handleCancel();
    }
  }

  function downloadCSV() {
    const header = "Professor;Data;Lição;Trimestre\n";
    const rows = filteredSchedules
      .map(item =>
        [item.teacher, item.date, item.lesson, item.quarter]
          .map(field => `"${(field || '').replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n");
    const csvContent = "\uFEFF" + header + rows;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "escala-professores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Busca e ordenação
  const filteredSchedules = schedules
    .filter(item =>
      item.teacher.toLowerCase().includes(search.toLowerCase()) ||
      item.date.includes(search) ||
      item.lesson.toString().includes(search) ||
      item.quarter.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (sortBy === 'lesson') {
        valA = parseInt(valA, 10);
        valB = parseInt(valB, 10);
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  function handleSort(field) {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Escala de Professores</h2>
      {toast && (
        <div className="mb-2 px-4 py-2 bg-green-100 text-green-800 rounded shadow text-center transition">
          {toast}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <input
          name="teacher"
          value={form.teacher}
          onChange={handleChange}
          placeholder="Nome do professor"
          className="w-full p-2 border rounded"
          required
        />
        <input
          name="date"
          type="date"
          value={form.date}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          name="lesson"
          value={form.lesson}
          onChange={handleChange}
          placeholder="Número da lição"
          className="w-full p-2 border rounded"
          required
        />
        <input
          name="quarter"
          value={form.quarter}
          onChange={handleChange}
          placeholder="Trimestre (ex: 1º 2025)"
          className="w-full p-2 border rounded"
          required
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
          {editingIndex !== null ? 'Salvar Alteração' : 'Adicionar'}
        </button>
        {editingIndex !== null && (
          <button
            type="button"
            className="ml-2 px-4 py-2 rounded bg-gray-400 text-white"
            onClick={handleCancel}
          >
            Cancelar
          </button>
        )}
      </form>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, data, lição ou trimestre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-2 py-1 w-full md:w-auto"
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={downloadCSV}
          disabled={filteredSchedules.length === 0}
        >
          Baixar Escala (CSV)
        </button>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>
              <button
                className="underline"
                onClick={() => handleSort('teacher')}
                aria-label="Ordenar por professor"
              >
                Professor {sortBy === 'teacher' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>
              <button
                className="underline"
                onClick={() => handleSort('date')}
                aria-label="Ordenar por data"
              >
                Data {sortBy === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>
              <button
                className="underline"
                onClick={() => handleSort('lesson')}
                aria-label="Ordenar por lição"
              >
                Lição {sortBy === 'lesson' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>
              <button
                className="underline"
                onClick={() => handleSort('quarter')}
                aria-label="Ordenar por trimestre"
              >
                Trimestre {sortBy === 'quarter' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filteredSchedules.map((item, idx) => (
            <tr key={idx}>
              <td>{item.teacher}</td>
              <td>{item.date}</td>
              <td>{item.lesson}</td>
              <td>{item.quarter}</td>
              <td>
                <button
                  className="text-blue-600 underline"
                  onClick={() => handleEdit(schedules.indexOf(item))}
                  aria-label={`Editar escala de ${item.teacher}`}
                >
                  Editar
                </button>
                <button
                  className="text-red-600 underline ml-2"
                  onClick={() => handleDelete(schedules.indexOf(item))}
                  aria-label={`Excluir escala de ${item.teacher}`}
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredSchedules.length === 0 && (
        <div className="text-center text-gray-500 mt-4">Nenhuma escala encontrada.</div>
      )}
    </div>
  );
}