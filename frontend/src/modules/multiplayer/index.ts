export { Placar, type LinhaDoPlacar } from "./componentes/Placar";
export { URL_DO_RELAY, deveEnviarEstado, lerSalasOnline, normalizarCodigo, urlDasSalas, urlParaCriarSala, urlParaEntrarNaSala, type SalaOnline } from "./online";
export {
  ATRASO_DO_INICIO_MS,
  MAXIMO_DE_JOGADORES,
  criarProtocolo,
  todosProntos,
  type EstadoBaseDaSala,
  type EstadoDaSalaEmRede,
  type JogadaNaSala,
  type Jogador,
  type MensagemDaSalaEmRede,
  type MensagemDoChatDaSala,
  type ModoDaSala,
  type PerfilNaSala,
  type ProtocoloDaSala,
  type ReacaoDaSala,
} from "./sala/protocolo";
export { PORTA_DA_SALA, criarConexaoDaSala, daMesmaSala, ehClienteWebDaSala, type ConexaoDaSala, type InfoDaSala, type ModoDaConexao, type SalaEncontrada } from "./sala/conexao";
export { LobbyDaSala, type PreparoDaEscolha, type PropsDoLobby } from "./componentes/LobbyDaSala";
export { ProcurarSala, type AcoesDaBusca } from "./componentes/ProcurarSala";
export { TelaDaSala } from "./componentes/TelaDaSala";
