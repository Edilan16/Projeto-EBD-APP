import React, { useRef, useState } from 'react';
import { collection, doc, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, Upload, ShieldCheck, LoaderCircle } from 'lucide-react';

const BACKUP_VERSION = 1;
const ROOT_COLLECTIONS = ['students', 'attendance', 'cashEntries', 'cashEntriesHistory', 'teacherSchedules'];
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

function encodeValue(value) {
  if (value instanceof Timestamp) return { __backupType: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof Date) return { __backupType: 'date', value: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)]));
  return value;
}
function decodeValue(value) {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    if (value.__backupType === 'timestamp' && Number.isFinite(value.seconds) && Number.isFinite(value.nanoseconds)) return new Timestamp(value.seconds, value.nanoseconds);
    if (value.__backupType === 'date' && typeof value.value === 'string') return new Date(value.value);
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, decodeValue(nested)]));
  }
  return value;
}
function safeId(value) { return typeof value === 'string' && value.length > 0 && !value.includes('/'); }
function validateBackup(value) {
  if (!value || value.format !== 'ebd-app-backup' || value.version !== BACKUP_VERSION || !value.collections) return false;
  if (!ROOT_COLLECTIONS.every(name => Array.isArray(value.collections[name]))) return false;
  return value.collections.students.every(item => safeId(item?.id) && item?.data && typeof item.data === 'object')
    && value.collections.attendance.every(item => safeId(item?.id) && item?.data && typeof item.data === 'object' && Array.isArray(item.records));
}

export default function DataBackup() {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function exportBackup() {
    setBusy(true); setStatus(''); setError('');
    try {
      const collections = {};
      for (const name of ROOT_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, name));
        const documents = [];
        for (const item of snapshot.docs) {
          const document = { id: item.id, data: encodeValue(item.data()) };
          if (name === 'attendance') {
            const records = await getDocs(collection(db, 'attendance', item.id, 'records'));
            document.records = records.docs.map(record => ({ id: record.id, data: encodeValue(record.data()) }));
          }
          documents.push(document);
        }
        collections[name] = documents;
      }
      const backup = { format: 'ebd-app-backup', version: BACKUP_VERSION, generatedAt: new Date().toISOString(), collections };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `backup-ebd-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Backup baixado. Guarde o arquivo em um local seguro.');
    } catch {
      setError('Não foi possível criar o backup. Confira sua conexão e tente novamente.');
    } finally { setBusy(false); }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setStatus('');
    if (file.size > MAX_BACKUP_BYTES) { setError('O arquivo excede o limite de 25 MB.'); return; }
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      if (!validateBackup(backup)) throw new Error('invalid-backup');
      const counts = ROOT_COLLECTIONS.reduce((sum, name) => sum + backup.collections[name].length, 0)
        + backup.collections.attendance.reduce((sum, item) => sum + item.records.length, 0);
      if (!counts) { setStatus('O backup está válido, mas não contém registros.'); return; }
      const date = backup.generatedAt ? new Date(backup.generatedAt).toLocaleString('pt-BR') : 'data desconhecida';
      if (!window.confirm(`Restaurar ${counts} registros do backup de ${date}? Os documentos com o mesmo ID serão atualizados; os demais dados atuais serão mantidos.`)) return;

      const writes = [];
      for (const name of ROOT_COLLECTIONS) {
        for (const item of backup.collections[name]) {
          if (!safeId(item?.id) || !item?.data || typeof item.data !== 'object' || Array.isArray(item.data)) throw new Error('invalid-document');
          writes.push({ ref: doc(db, name, item.id), data: decodeValue(item.data) });
          if (name === 'attendance') {
            for (const record of item.records || []) {
              if (!safeId(record?.id) || !record?.data || typeof record.data !== 'object' || Array.isArray(record.data)) throw new Error('invalid-document');
              writes.push({ ref: doc(db, 'attendance', item.id, 'records', record.id), data: decodeValue(record.data) });
            }
          }
        }
      }
      for (let start = 0; start < writes.length; start += 450) {
        const batch = writeBatch(db);
        writes.slice(start, start + 450).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
        await batch.commit();
      }
      setStatus(`Restauração concluída: ${writes.length} registros enviados ao Firebase. Os dados atuais que não estavam no backup foram mantidos.`);
    } catch (restoreError) {
      setError(restoreError.message === 'invalid-backup' || restoreError.message === 'invalid-document'
        ? 'O arquivo não é um backup válido deste aplicativo ou contém um registro inválido.'
        : 'Não foi possível concluir a restauração. Tente novamente; parte dos dados pode já ter sido restaurada.');
    } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-3xl space-y-6">
    <header><h1 className="page-title">Backup e restauração</h1><p className="page-subtitle">Baixe uma cópia dos dados ou recupere informações de um backup anterior.</p></header>
    {status && <p role="status" className="surface border-l-4 border-emerald-600 p-4 text-emerald-900 dark:text-emerald-200">{status}</p>}
    {error && <p role="alert" className="surface border-l-4 border-rose-600 p-4 text-rose-800 dark:text-rose-200">{error}</p>}
    <article className="surface space-y-4 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"><Download/></span><div><h2 className="text-lg font-semibold">Baixar backup</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Inclui alunos, chamadas e presenças, escala de professores e lançamentos financeiros.</p></div></div><button onClick={exportBackup} disabled={busy} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18}/> : <Download size={18}/>}Baixar arquivo de backup</button></article>
    <article className="surface space-y-4 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"><Upload/></span><div><h2 className="text-lg font-semibold">Restaurar backup</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Selecione um arquivo JSON baixado deste aplicativo. A restauração mescla os dados: atualiza IDs iguais e mantém os registros exclusivos do Firebase.</p></div></div><input ref={fileRef} type="file" accept="application/json,.json" onChange={restoreBackup} disabled={busy} className="field"/><p className="text-xs text-gray-500 dark:text-gray-400">A restauração pede confirmação e pode levar algum tempo. Se houver falha de conexão, confira os dados antes de repetir.</p></article>
    <aside className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><ShieldCheck size={19} className="mt-0.5 shrink-0"/><p>O arquivo contém dados pessoais e financeiros. Guarde-o em local protegido e não o compartilhe publicamente.</p></aside>
  </section>;
}
