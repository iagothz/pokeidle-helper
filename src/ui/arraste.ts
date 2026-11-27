import { useEffect, useRef, useState } from 'preact/hooks';
import { limitarPosicao, type Posicao } from '../shared/preferencias';

interface Arraste {
  dx: number;
  dy: number;
  alvo: HTMLElement;
}

export function usarArraste(inicial: Posicao | null, aoSoltar: (p: Posicao) => void) {
  const [posicao, definirPosicao] = useState<Posicao | null>(inicial);
  const arraste = useRef<Arraste | null>(null);
  const ultima = useRef<Posicao | null>(inicial);
  const soltar = useRef(aoSoltar);
  soltar.current = aoSoltar;

  useEffect(() => {
    const mover = (e: MouseEvent) => {
      const a = arraste.current;
      if (!a) return;
      const rect = a.alvo.getBoundingClientRect();
      const nova = limitarPosicao(
        { x: e.clientX - a.dx, y: e.clientY - a.dy },
        { largura: rect.width, altura: rect.height },
        { largura: window.innerWidth, altura: window.innerHeight },
      );
      ultima.current = nova;
      definirPosicao(nova);
    };
    const parar = () => {
      if (!arraste.current) return;
      arraste.current = null;
      if (ultima.current) soltar.current(ultima.current);
    };
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', parar);
    return () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', parar);
    };
  }, []);

  const iniciar = (e: MouseEvent, alvo: HTMLElement | null) => {
    if (e.button !== 0 || !alvo) return;
    if ((e.target as HTMLElement | null)?.closest?.('button')) return;
    const rect = alvo.getBoundingClientRect();
    arraste.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, alvo };
    e.preventDefault();
  };

  return { posicao, iniciar };
}
