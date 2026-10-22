/**
 * Um tema reúne as cores da interface e a skin da pista.
 * Para criar um tema novo, copie um existente, troque os valores e registre-o em TEMAS.
 * Os testes em tokens.test.ts conferem automaticamente as regras de docs/design.md.
 */
export interface Tema {
  nome: string;
  cores: {
    /** Neutros frios e levemente tingidos; quanto mais elevada a superfície, mais clara. */
    fundo: string;
    superficie: string;
    superficieElevada: string;
    borda: string;
    texto: string;
    textoSuave: string;
    /** Paleta com brilhos distintos para não disputarem atenção (design.md, regra 4). */
    primaria: string;
    sucesso: string;
    perigo: string;
    destaque: string;
    /** Cores de jogo: recordes e coroas (ouro) e o poder de estrela. */
    ouro: string;
    estrela: string;
  };
  /** Skin do canvas da pista, onde o brilho neon é permitido. */
  pista: {
    trastes: string[];
    notaDeEstrela: string;
    multiplicador: string[];
    notaPerdida: string;
    /** Gradiente do trilho com a estrela ativa: topo, meio e base. */
    trilhoDaEstrela: [string, string, string];
  };
}

const PISTA_CLASSICA: Tema["pista"] = {
  trastes: ["#22c55e", "#ef4444", "#eab308", "#3b82f6", "#f97316"],
  notaDeEstrela: "#e0f2fe",
  multiplicador: ["#e5e7eb", "#facc15", "#22c55e", "#a855f7"],
  notaPerdida: "#71717a",
  trilhoDaEstrela: ["#0ea5e9", "#0e7490", "#082f49"],
};

export const TEMAS = {
  /** Cores da logo: preto, creme gasto, vermelho dos raios e os trastes clássicos. Neutros quentes. */
  riffRush: {
    nome: "Riff Rush",
    cores: {
      fundo: "#0f0e0d",
      superficie: "#1a1817",
      superficieElevada: "#24211f",
      borda: "#3a3633",
      texto: "#e8e4dc",
      textoSuave: "#a7a39b",
      primaria: "#e3191f",
      sucesso: "#16a34a",
      perigo: "#b91c1c",
      destaque: "#ff8a1f",
      ouro: "#facc15",
      estrela: "#38bdf8",
    },
    pista: {
      ...PISTA_CLASSICA,
      trastes: ["#22c55e", "#e3191f", "#facc15", "#3b9cf0", "#f7931e"],
    },
  },
  crimsonNoir: {
    nome: "Crimson Noir",
    cores: {
      fundo: "#0b0b0d",
      superficie: "#1f1f24",
      superficieElevada: "#25252b",
      borda: "#34343c",
      texto: "#f2f2f2",
      textoSuave: "#a8a8b0",
      primaria: "#c1121f",
      sucesso: "#16a34a",
      perigo: "#dc2626",
      destaque: "#ff4d4d",
      ouro: "#facc15",
      estrela: "#38bdf8",
    },
    pista: PISTA_CLASSICA,
  },
  synthwave: {
    nome: "Synthwave",
    cores: {
      fundo: "#121117",
      superficie: "#1b1a21",
      superficieElevada: "#252430",
      borda: "#34333f",
      texto: "#f3f2f7",
      textoSuave: "#aaa8b4",
      primaria: "#a21caf",
      sucesso: "#22c55e",
      perigo: "#dc2626",
      destaque: "#fb923c",
      ouro: "#facc15",
      estrela: "#38bdf8",
    },
    pista: PISTA_CLASSICA,
  },
} satisfies Record<string, Tema>;

export const temaAtivo: Tema = TEMAS.riffRush;
