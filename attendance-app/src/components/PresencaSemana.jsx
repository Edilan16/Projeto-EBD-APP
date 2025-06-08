
import React from 'react';

export default function PresencaSemana({ semana, presentes, ausentes }) {
  const listaPresentes = Array.isArray(presentes) ? presentes : [];
  const listaAusentes = Array.isArray(ausentes) ? ausentes : [];

  return (
    <div className="mb-4 p-3 border rounded bg-gray-50">
      <div><b>Semana:</b> {semana}</div>
      <div className="flex flex-wrap gap-6 mt-2">
        <div>
          <b>Presentes:</b>
          <ul className="list-disc ml-5">
            {listaPresentes.length > 0
              ? listaPresentes.map(nome => <li key={nome}>{nome}</li>)
              : <li>Nenhum presente</li>}
          </ul>
        </div>
        <div>
          <b>Ausentes:</b>
          <ul className="list-disc ml-5">
            {listaAusentes.length > 0
              ? listaAusentes.map(nome => <li key={nome}>{nome}</li>)
              : <li>Nenhum ausente</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
