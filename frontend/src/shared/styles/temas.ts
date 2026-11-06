/**
 * Um tema reúne as cores da interface e a skin da pista.
 * Para criar um tema novo, copie um existente, troque os valores e registre-o em TEMAS.
 * Os testes em tokens.test.ts conferem automaticamente as regras de docs/design.md.
 */
export interface Tema {
  nome: string;
  /** Claro ou escuro: muda as regras de contraste e o colorScheme do navegador. Sem ele, o tema é escuro. */
  esquema?: "claro" | "escuro";
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
    /** A nota aberta, a barra que atravessa a pista. */
    aberta: string;
    notaDeEstrela: string;
    multiplicador: string[];
    notaPerdida: string;
    /** Gradiente do trilho com a estrela ativa: topo, meio e base. */
    trilhoDaEstrela: [string, string, string];
  };
}

const PISTA_CLASSICA: Tema["pista"] = {
  trastes: ["#22c55e", "#ef4444", "#eab308", "#3b82f6", "#f97316"],
  aberta: "#a855f7",
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
  /** Riff Rush Mania: rosa sobre roxo uva quase preto. Neutros frios, tingidos de roxo. */
  mania: {
    nome: "Riff Rush Mania",
    cores: {
      fundo: "#130d17",
      superficie: "#1b1420",
      superficieElevada: "#241d29",
      borda: "#3a333f",
      texto: "#f4eff8",
      textoSuave: "#b1aab6",
      primaria: "#e0357f",
      sucesso: "#16a34a",
      perigo: "#b91c1c",
      destaque: "#f472b6",
      ouro: "#facc15",
      estrela: "#38bdf8",
    },
    pista: PISTA_CLASSICA,
  },
} satisfies Record<string, Tema>;

/** O tema da abertura e o da landing. O tema da interface muda com o modo de jogo (tema.ts). */
export const TEMA_PADRAO: Tema = TEMAS.riffRush;

/** Tom do braço de uma skin pronta da pista do Rock. */
export interface CoresDaSkinDaPista {
  braco: string;
}

/** Skins prontas da pista do Rock, originais do Riff Rush. */
export const SKINS_DA_PISTA = {
  classica: { braco: TEMAS.riffRush.cores.superficie },
  neon: { braco: "#15131f" },
  brasa: { braco: "#2a1a12" },
  gelo: { braco: "#16202a" },
  contraste: { braco: "#121212" },
} satisfies Record<string, CoresDaSkinDaPista>;

/** Cores das caçapas e das notas: os 5 trastes (verde, vermelho, amarelo, azul e laranja) e a nota aberta. */
export interface CoresDaCacapa {
  trastes: string[];
  aberta: string;
}

/** Caçapas prontas do Rock, originais do Riff Rush. */
export const CORES_DAS_CACAPAS = {
  classica: { trastes: TEMAS.riffRush.pista.trastes, aberta: TEMAS.riffRush.pista.aberta },
  neon: { trastes: ["#4ade80", "#fb3f6c", "#fde047", "#38bdf8", "#fb923c"], aberta: "#c084fc" },
  colmeia: { trastes: ["#16a34a", "#dc2626", "#eab308", "#2563eb", "#f97316"], aberta: "#9333ea" },
  cromada: { trastes: ["#86efac", "#fca5a5", "#fef08a", "#93c5fd", "#fdba74"], aberta: "#d8b4fe" },
  contraste: { trastes: ["#00d26a", "#ff2d2d", "#ffe600", "#2f7bff", "#ff8c00"], aberta: "#b44dff" },
} satisfies Record<string, CoresDaCacapa>;
