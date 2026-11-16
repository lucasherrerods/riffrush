import { criarConexaoDaSala } from "@/modules/multiplayer";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { paraRede, podeJogarOnline } from "./mapaNaRede";
import { protocoloDoMania } from "./protocolo";

const conexao = criarConexaoDaSala(protocoloDoMania, "mania");

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
} = conexao;

/**
 * Só o host: escolhe o mapa e os mods da sala. Na LAN, um mapa importado sai do host:
 * o .osz é compartilhado antes do aviso, para os convidados já poderem baixar.
 */
export async function escolherMapa(conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva, mods: number, lerOsz: (id: string) => Promise<Blob | undefined>) {
  const { sala, online } = lerConexao();
  if (!sala?.souHost) return;
  if (online && !podeJogarOnline(conjunto)) throw new Error("No modo online só dá para jogar mapas baixados pela busca.");
  const mapa = paraRede(conjunto, dificuldade);
  if (!online && mapa.tipo === "importado" && mapa.hash !== sala.mapa?.hash) {
    const osz = await lerOsz(conjunto.id);
    if (!osz) throw new Error("Não achei o arquivo deste mapa.");
    await conexao.compartilharArquivo(osz);
  }
  conexao.escolher({ mapa, mods });
}

/** Só o host: troca os mods e mantém o mapa. */
export function escolherMods(mods: number) {
  const { sala } = lerConexao();
  if (sala?.souHost) conexao.escolher({ mapa: sala.mapa, mods });
}

/** Só o host: dá a largada para todos. */
export function comecar() {
  if (!lerConexao().sala?.mapa) throw new Error("Escolha um mapa primeiro.");
  conexao.darLargada();
}
