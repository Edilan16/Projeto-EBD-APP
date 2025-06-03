import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  query,
  where,
  onSnapshot,
  setDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { startOfWeek, format } from 'date-fns';
import debounce from 'lodash.debounce';

export default function Attendance() {
  const [students, setStudents] = useState([]);
  const [attendanceId, setAttendanceId] = useState(null);
  const [records, setRecords] = useState({});
  const [toast, setToast] = useState('');

  // calcula o domingo da semana atual
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const weekOf = format(weekStart, 'yyyy-MM-dd');

  // carrega ou cria o documento de attendance para weekOf
  useEffect(() => {
    const q = query(collection(db, 'attendance'), where('weekOf', '==', weekOf));
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) {
        addDoc(collection(db, 'attendance'), { weekOf, createdAt: serverTimestamp() })
          .then(r => setAttendanceId(r.id));
      } else {
        setAttendanceId(snap.docs[0].id);
      }
    });
    return () => unsub();
  }, [weekOf]);

  // carrega lista de alunos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), s => {
      setStudents(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // carrega registros de presença
  useEffect(() => {
    if (!attendanceId) return;
    const recColl = collection(db, 'attendance', attendanceId, 'records');
    const unsub = onSnapshot(recColl, s => {
      const rec = {};
      s.docs.forEach(d => rec[d.id] = d.data());
      setRecords(rec);
    });
    return () => unsub();
  }, [attendanceId]);

  // Toast temporário
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // Salva múltiplos registros em batch
  const handleBulkSave = useCallback(async (presentValue = true) => {
    if (!attendanceId) return;
    const batch = writeBatch(db);
    students.forEach(student => {
      const recordRef = doc(db, 'attendance', attendanceId, 'records', student.id);
      batch.set(recordRef, {
        studentId: student.id,
        present: presentValue,
        date: weekOf,
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
    showToast(presentValue ? 'Todos marcados como presentes!' : 'Todos marcados como ausentes!');
  }, [attendanceId, students, weekOf]);

  // Atualiza presença de um aluno (confirmação só ao remover)
  const togglePresent = useCallback(async (studentId, present, studentName) => {
    if (!attendanceId) return;
    if (!present) {
      const confirmed = window.confirm(`Tem certeza que deseja remover presença para "${studentName}"?`);
      if (!confirmed) return;
    }
    const recordRef = doc(db, 'attendance', attendanceId, 'records', studentId);
    await setDoc(recordRef, {
      studentId,
      present,
      date: weekOf,
      updatedAt: serverTimestamp()
    });
    showToast(
      present
        ? `Presença marcada para "${studentName}"`
        : `Presença removida para "${studentName}"`
    );
  }, [attendanceId, weekOf]);

  // Debounce do toggle
  const debouncedToggle = useMemo(
    () => debounce((id, present, name) => togglePresent(id, present, name), 200),
    [togglePresent]
  );

  return (
    <div>
      <h2>Presenças da semana: {weekOf}</h2>
      <div className="mb-4 flex gap-2">
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => handleBulkSave(true)}
        >
          Marcar todos presentes
        </button>
        <button
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-700"
          onClick={() => handleBulkSave(false)}
        >
          Marcar todos ausentes
        </button>
      </div>
      {toast && (
        <div className="mb-2 px-4 py-2 bg-green-100 text-green-800 rounded shadow text-center transition">
          {toast}
        </div>
      )}
      <ul className="space-y-2">
        {students
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(s => {
            const isPresent = !!records[s.id]?.present;
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between p-2 rounded transition ${
                  isPresent
                    ? 'bg-green-100 border border-green-300'
                    : 'bg-gray-50'
                }`}
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-blue-600"
                    checked={isPresent}
                    onChange={e => debouncedToggle(s.id, e.target.checked, s.name)}
                  />
                  <span>{s.name}</span>
                </label>
                {isPresent && (
                  <span className="text-sm text-gray-500">
                    Registrado em {records[s.id].date}
                  </span>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}