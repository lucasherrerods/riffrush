/**
 * Reações do personagem aos momentos da partida: errar uma nota, ativar o nitro (star power),
 * vencer e perder. São poses e expressões somadas por cima da animação que estiver tocando,
 * então funcionam com qualquer personagem e qualquer animação de instrumento.
 */
export type TipoDeReacao = "errou" | "nitro" | "vitoria" | "derrota";

/** O contador muda a cada reação nova, para a mesma reação poder se repetir (como o `pulso` dos acertos). */
export interface Reacao {
  tipo: TipoDeReacao;
  contador: number;
}

type Euler = [number, number, number];
export type Ajustes = Record<string, Euler>;

/** Segundos que cada reação dura. Vitória e derrota ficam até a tela mudar. */
export const DURACAO_DA_REACAO: Record<TipoDeReacao, number> = {
  errou: 0.5,
  nitro: 1.6,
  vitoria: Infinity,
  derrota: Infinity,
};

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function novaReacao(anterior: Reacao | null | undefined, tipo: TipoDeReacao): Reacao {
  return { tipo, contador: (anterior?.contador ?? 0) + 1 };
}

/**
 * Pose (rotações somadas aos ossos normalizados do VRM, como em `ajustesDaPose`) e pesos das
 * expressões de uma reação, `desde` segundos depois de ela começar.
 * Ângulo x positivo inclina para a frente; negativo, para trás.
 */
export function reacaoDoAtor(tipo: TipoDeReacao | null, desde: number): { ossos: Ajustes; expressoes: Record<string, number>; ativa: boolean } {
  const parado = { ossos: {}, expressoes: {}, ativa: false };
  if (!tipo || desde < 0 || desde > DURACAO_DA_REACAO[tipo]) return parado;

  switch (tipo) {
    case "errou": {
      // Sobe rápido e volta devagar: um tranco, como levar um choque da guitarra.
      const forca = Math.sin(Math.PI * Math.sqrt(desde / DURACAO_DA_REACAO.errou));
      return {
        ativa: true,
        ossos: { spine: [-0.08 * forca, 0, 0], neck: [-0.08 * forca, 0, 0], head: [-0.22 * forca, 0, 0.14 * forca] },
        expressoes: { sad: 0.9 * forca },
      };
    }
    case "nitro": {
      const duracao = DURACAO_DA_REACAO.nitro;
      const forca = suave(0, 0.15, desde) * (1 - suave(duracao - 0.3, duracao, desde));
      // Primeiro olha para cima de boca aberta; depois sorri e bate cabeça no ritmo.
      const bateCabeca = suave(0.4, 0.6, desde);
      const cabeca = -0.3 * (1 - bateCabeca) + bateCabeca * 0.22 * Math.sin((desde - 0.5) * Math.PI * 2 * 3.5);
      return {
        ativa: true,
        ossos: { spine: [-0.22 * forca, 0, 0], chest: [-0.1 * forca, 0, 0], head: [cabeca * forca, 0, 0] },
        expressoes: { surprised: suave(0, 0.12, desde) * (1 - suave(0.35, 0.55, desde)), happy: suave(0.35, 0.6, desde) * forca },
      };
    }
    case "vitoria": {
      const entrada = suave(0, 0.4, desde);
      return {
        ativa: true,
        ossos: { spine: [-0.18 * entrada, 0, 0], chest: [-0.1 * entrada, 0, 0], head: [(-0.25 + 0.1 * Math.sin(desde * Math.PI * 4)) * entrada, 0, 0] },
        expressoes: { happy: suave(0, 0.3, desde) },
      };
    }
    case "derrota": {
      // Desaba devagar, como quem não acredita.
      const queda = suave(0, 0.8, desde);
      return {
        ativa: true,
        ossos: { spine: [0.35 * queda, 0, 0], chest: [0.15 * queda, 0, 0], neck: [0.2 * queda, 0, 0], head: [0.45 * queda, 0, 0] },
        expressoes: { sad: 1 },
      };
    }
  }
}

/** Soma as rotações de dois conjuntos de ajustes, osso a osso. */
export function combinarAjustes(a: Ajustes, b: Ajustes): Ajustes {
  const resultado: Ajustes = { ...a };
  for (const [osso, [x, y, z]] of Object.entries(b)) {
    const atual = resultado[osso] ?? [0, 0, 0];
    resultado[osso] = [atual[0] + x, atual[1] + y, atual[2] + z];
  }
  return resultado;
}

/** Pesos finais das expressões: os da reação substituem os do humor do personagem. */
export function expressoesComReacao(base: Record<string, number>, reacao: Record<string, number>) {
  return { ...base, ...reacao };
}

const VITORIA: Reacao = { tipo: "vitoria", contador: 1 };
const DERROTA: Reacao = { tipo: "derrota", contador: 1 };

/** Reação de quem já terminou a música (o adversário na sala, por exemplo). */
export function reacaoDoFimDaPartida({ terminou, derrota }: { terminou: boolean; derrota: boolean }): Reacao | null {
  if (derrota) return DERROTA;
  return terminou ? VITORIA : null;
}
