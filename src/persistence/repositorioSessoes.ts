import type { Sessao } from '../domain/sessao';
import type { Banco } from './banco';

export class RepositorioSessoes {
  constructor(private readonly banco: Banco) {}

  salvar(sessao: Sessao): Promise<string> {
    return this.banco.put('sessoes', sessao);
  }

  listar(): Promise<Sessao[]> {
    return this.banco.getAllFromIndex('sessoes', 'porInicio');
  }

  listarPorHunt(slug: string): Promise<Sessao[]> {
    return this.banco.getAllFromIndex('sessoes', 'porHunt', slug);
  }

  async fecharAbertas(): Promise<number> {
    const tx = this.banco.transaction('sessoes', 'readwrite');
    let fechadas = 0;
    for await (const cursor of tx.store) {
      if (cursor.value.aberta) {
        await cursor.update({ ...cursor.value, aberta: false });
        fechadas++;
      }
    }
    await tx.done;
    return fechadas;
  }

  limpar(): Promise<void> {
    return this.banco.clear('sessoes');
  }
}
