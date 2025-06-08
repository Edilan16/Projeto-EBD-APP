
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { Bar } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportsCompleto() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      let allRecords = [];
      for (const docSnap of attendanceSnap.docs) {
        const recordsSnap = await getDocs(collection(db, 'attendance', docSnap.id, 'records'));
        recordsSnap.forEach(r => {
          allRecords.push({ ...r.data(), id: r.id });
        });
      }
      setRecords(allRecords);
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return records
      .filter(r => r.studentName && r.date)
      .filter(r => (search ? r.studentName.toLowerCase().includes(search.toLowerCase()) : true))
      .filter(r => (selectedMonth ? r.date.startsWith(selectedMonth) : true));
  }, [records, search, selectedMonth]);

  const resumo = useMemo(() => {
    const mapa = {};
    filtered.forEach(r => {
      if (!mapa[r.studentId]) mapa[r.studentId] = { name: r.studentName, total: 0, presentes: 0 };
      mapa[r.studentId].total++;
      if (r.present) mapa[r.studentId].presentes++;
    });
    return Object.values(mapa).map(r => ({
      ...r,
      frequencia: ((r.presentes / r.total) * 100).toFixed(1)
    })).sort((a, b) => b.frequencia - a.frequencia);
  }, [filtered]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(resumo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Frequencia');
    XLSX.writeFile(wb, 'relatorio_frequencia.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Frequência', 14, 10);
    autoTable(doc, {
      head: [['Aluno', 'Presenças', 'Total', 'Frequência %']],
      body: resumo.map(r => [r.name, r.presentes, r.total, r.frequencia])
    });
    doc.save('relatorio_frequencia.pdf');
  };

  const chartData = {
    labels: resumo.map(r => r.name),
    datasets: [
      {
        label: 'Frequência %',
        data: resumo.map(r => r.frequencia),
        backgroundColor: 'rgba(54, 162, 235, 0.7)'
      }
    ]
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Relatório de Frequência</h2>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome"
          className="p-2 border rounded"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          type="month"
          className="p-2 border rounded"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        />
        <button onClick={exportToExcel} className="px-4 py-2 bg-green-600 text-white rounded">
          Exportar Excel
        </button>
        <button onClick={exportToPDF} className="px-4 py-2 bg-red-600 text-white rounded">
          Exportar PDF
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="px-4 py-2">Aluno</th>
              <th className="px-4 py-2">Presenças</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Frequência %</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.presentes}</td>
                <td className="px-4 py-2">{r.total}</td>
                <td className="px-4 py-2">{r.frequencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Bar data={chartData} />
      </div>
    </div>
  );
}
