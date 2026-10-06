import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useUserRole } from '../hooks/useUserRole';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Search, UserPlus, Users, Trash2, GraduationCap } from 'lucide-react';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [user] = useAuthState(auth);
  const { role } = useUserRole(user);
  const canEdit = role === 'admin';
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(collection(db, 'students'), snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')))), []);
  const filtered = useMemo(() => students.filter(student => (student.name || '').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))), [students, search]);

  const handleAdd = useCallback(async e => {
    e.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) return;
    setSaving(true); setError('');
    try { await addDoc(collection(db, 'students'), { name: cleanName, createdAt: new Date() }); setName(''); }
    catch { setError('Não foi possível cadastrar o aluno. Tente novamente.'); }
    finally { setSaving(false); }
  }, [name]);

  const handleDelete = useCallback(async (id, studentName) => {
    if (!window.confirm(`Deseja excluir o cadastro de ${studentName}?`)) return;
    try { await deleteDoc(doc(db, 'students', id)); }
    catch { setError('Não foi possível excluir o aluno. Tente novamente.'); }
  }, []);

  return <section>
    <div className="mb-6"><p className="page-title">Cadastro de alunos</p><p className="page-subtitle">Organize sua turma e encontre os cadastros rapidamente.</p></div>
    {canEdit && <div className="surface mb-5 p-4 sm:p-6"><form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row"><label htmlFor="student-name" className="sr-only">Nome do aluno</label><input id="student-name" value={name} onChange={e => setName(e.target.value)} placeholder="Digite o nome do aluno" className="field flex-1" maxLength={100} required/><button className="btn-primary flex items-center justify-center gap-2" type="submit" disabled={saving}><UserPlus size={18}/>{saving ? 'Salvando…' : 'Adicionar aluno'}</button></form>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</div>}
    {!canEdit && <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Professores têm acesso de consulta; somente administradores podem alterar os cadastros.</p>}<div className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-2"><Users size={18} className="text-emerald-700 dark:text-emerald-400"/><h2 className="font-semibold">Turma <span className="ml-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">{students.length}</span></h2></div><div className="relative w-full sm:max-w-xs"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="field pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno…" aria-label="Buscar aluno"/></div></div>
    {filtered.length ? <ul className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map((student, index) => <li key={student.id} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-700/40 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"><GraduationCap size={19}/></span><div className="min-w-0"><p className="truncate font-medium">{student.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">Aluno {index + 1}</p></div></div>{canEdit && <button onClick={() => handleDelete(student.id, student.name)} aria-label={`Excluir ${student.name}`} className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={18}/></button>}</li>)}</ul> : <div className="px-6 py-12 text-center"><Users className="mx-auto mb-3 text-gray-300" size={34}/><p className="font-medium">{search ? 'Nenhum aluno encontrado' : 'Sua turma ainda está vazia'}</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{search ? 'Tente outro nome.' : 'Cadastre o primeiro aluno no campo acima.'}</p></div>}</div>
  </section>;
}


