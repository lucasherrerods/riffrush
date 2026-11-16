import { criarConexaoDaSala, type ConexaoDaSala } from "@/modules/multiplayer";
import { dificuldadeMaisProxima, dificuldadesDaMusica, instrumentoDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { paraRede, podeTocarOnline } from "./musicaNaRede";
import { protocoloDoRock, type EstadoDaSala } from "./protocolo";

export { PORTA_DA_SALA, ehClienteWebDaSala, type InfoDaSala, type SalaEncontrada } from "@/modules/multiplayer";

export type Conexao = ConexaoDaSala<EstadoDaSala>;

const conexao = criarConexaoDaSala(protocoloDoRock, "rock");

export const {
  lerConexao,
  useConexao,
  criarSala,
  entrarNaSala,
  temModoOnline,
  criarSalaOnline,
  procurarSalasOnline,
  entrarNaSalaOnline,
  sairDaSala,
  expulsar,
  passarLideranca,
  marcarPronto,
  enviarEstado,
  enviarChat,
  voltarParaASala,
  atualizarPersonagem,
  procurarSalas,
} = conexao;

/** Só o host: troca a música, a dificuldade ou o instrumento da sala. Sem o instrumento, fica o da sala. */
export async function escolher(musica: Musica, dificuldade: Dificuldade, instrumento?: Instrumento) {
  const { sala, online } = lerConexao();
  if (!sala?.souHost) return;
  // Na LAN o arquivo importado sai do host: compartilha antes de avisar, para os convidados já poderem baixar.
  if (!online && musica.arquivo && musica.id !== sala.musica.id) await conexao.compartilharArquivo(musica.arquivo);
  const atual = lerConexao().sala;
  if (!atual) return;
  // Música nova sem o instrumento ou a dificuldade da sala: vai para o que o chart tem de mais próximo.
  const tocado = instrumentoDaMusica(musica, instrumento ?? atual.instrumento);
  const disponiveis = dificuldadesDaMusica(musica, tocado).map((d) => d.id);
  const ajustada = dificuldadeMaisProxima(disponiveis, dificuldade) ?? dificuldade;
  conexao.escolher({ musica: paraRede(musica, { online }), dificuldade: ajustada, instrumento: tocado });
}

/** Só o host: compartilha a música importada (se for o caso) e dá a largada para todos. */
export async function comecar(musica: Musica) {
  if (!lerConexao().sala?.souHost) return;
  if (lerConexao().online && !podeTocarOnline(musica)) throw new Error("No modo online só dá para tocar músicas do jogo ou baixadas pela Busca músicas.");
  await escolher(musica, lerConexao().sala!.dificuldade);
  if (!lerConexao().sala) return;
  conexao.darLargada();
}
