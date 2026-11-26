export const CHAVES_SENSIVEIS =
  /^(token|tokens?Sessao|email|e-?mail|senha|password|cpf|carteira|wallet|endereco|enderecoSolana|ip|dispositivo|idDispositivo|cookie|segredo|secret)$/i;

const PROFUNDIDADE_MAXIMA = 12;

export function removerSensiveis<T>(valor: T, profundidade = 0): T {
  if (profundidade > PROFUNDIDADE_MAXIMA || valor === null || typeof valor !== 'object')
    return valor;
  if (Array.isArray(valor)) return valor.map((v) => removerSensiveis(v, profundidade + 1)) as T;
  const limpo: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CHAVES_SENSIVEIS.test(chave)) continue;
    limpo[chave] = removerSensiveis(v, profundidade + 1);
  }
  return limpo as T;
}
