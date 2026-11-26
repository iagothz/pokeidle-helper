const FORMATO_VERSAO = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/;
const ARQUIVO_PRINCIPAL = '/app.js';

export function lerVersaoJogo(documento: Document): string | null {
  for (const script of documento.querySelectorAll('script[src]')) {
    const versao = versaoDoSrc(script.getAttribute('src') ?? '', documento.baseURI);
    if (versao) return versao;
  }
  return null;
}

function versaoDoSrc(src: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(src, base);
  } catch {
    return null;
  }
  if (!url.pathname.endsWith(ARQUIVO_PRINCIPAL)) return null;
  const versao = url.searchParams.get('v');
  return versao && FORMATO_VERSAO.test(versao) ? versao : null;
}
