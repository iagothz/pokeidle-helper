const PRECISA_ASPAS = /[",\r\n]/;

function celula(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const texto = String(v);
  return PRECISA_ASPAS.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function paraCsv(colunas, linhas) {
  return [colunas, ...linhas].map((l) => l.map(celula).join(',') + '\r\n').join('');
}
