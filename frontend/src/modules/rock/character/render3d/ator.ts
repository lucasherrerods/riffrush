import * as THREE from "three";
import { VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { POSE_DE_DESCANSO, ajustesDaPose, animacaoDoInstrumento } from "../animacao";
import { pesosDasExpressoes } from "../aparencia";
import { instrumentoDoPersonagem, skinDoPersonagem } from "../catalogo";
import { criarAtorDeVideo } from "./atorDeVideo";
import { combinarAjustes, expressoesComReacao, novaReacao, reacaoDoAtor, type Reacao, type TipoDeReacao } from "../reacao";
import { migrarPersonagem, type Personagem } from "../personagem";
import { criarAjustador } from "./ajustes";
import { criarInstrumento, encaixarNasMaos, type Montado } from "./instrumentos";
import { animacaoParaVRM, carregarVRM } from "./vrm";

export interface EstadoDoAvatar {
  personagem: Personagem;
  tocando: boolean;
  bpm: number;
  pulso: number;
  triste: boolean;
  /** Reação ao momento da partida (erro, nitro, vitória, derrota). Muda o contador para disparar de novo. */
  reacao?: Reacao | null;
}

/**
 * O personagem VRM vivo: carrega o modelo, veste as peças, troca as animações compartilhadas
 * com transição e aplica expressões e customização. Quem usa só precisa pôr `raiz` numa cena
 * e chamar `animar` a cada quadro (a tela de Personagem, os avatares do HUD, o palco).
 */
export interface Ator {
  raiz: THREE.Group;
  atualizar(estado: EstadoDoAvatar): void;
  /** Dispara uma reação na hora, sem passar pelo estado. */
  reagir(tipo: TipoDeReacao): void;
  animar(agora: number, dt: number): void;
  /** Altura do modelo carregado, em metros (null enquanto carrega). */
  altura(): number | null;
  descartar(): void;
}

interface Modelo {
  vrm: VRM;
  mixer: THREE.AnimationMixer;
  descanso: THREE.AnimationAction;
  acao: THREE.AnimationAction;
  /** Id da animação tocando agora (null é a pose de descanso), ou o id que está sendo carregado. */
  animacao: string | null;
  instrumentos: Montado[];
  ajustador: ReturnType<typeof criarAjustador>;
  /** O que exige recarregar o modelo inteiro quando muda. */
  chave: string;
  altura: number;
}

const TRANSICAO = 0.4;
const EXPRESSOES_CONTROLADAS = ["happy", "sad", "angry", "relaxed", "surprised", "blink"];
const euler = new THREE.Euler();
const maoDireita = new THREE.Vector3();
const maoEsquerda = new THREE.Vector3();
const frente = new THREE.Vector3();
const coxa = new THREE.Vector3();
const tronco = new THREE.Vector3();
const CIMA = new THREE.Vector3(0, 1, 0);

const chaveDoModelo = (p: Personagem) => skinDoPersonagem(p).arquivo;
const nomeDoOsso = (vrm: VRM, osso: string) => vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName)?.name;

/** A pose de descanso vira um clipe parado, para o mixer fazer a transição suave com as animações. */
function clipeDeDescanso(vrm: VRM) {
  const ossos = { spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], ...POSE_DE_DESCANSO };
  const trilhas = Object.entries(ossos).flatMap(([osso, [x, y, z]]) => {
    const nome = nomeDoOsso(vrm, osso);
    if (!nome) return [];
    return [new THREE.QuaternionKeyframeTrack(`${nome}.quaternion`, [0], new THREE.Quaternion().setFromEuler(euler.set(x, y, z)).toArray())];
  });
  return new THREE.AnimationClip("descanso", -1, trilhas);
}

function trocarInstrumento(modelo: Modelo, personagem: Personagem) {
  for (const { objeto } of modelo.instrumentos) objeto.removeFromParent();
  modelo.instrumentos = criarInstrumento(instrumentoDoPersonagem(personagem));
  for (const { objeto, osso } of modelo.instrumentos) {
    if (osso === "maos") modelo.vrm.scene.add(objeto);
    else modelo.vrm.humanoid.getNormalizedBoneNode(osso)?.add(objeto);
  }
}

/** Leva os instrumentos de duas mãos para onde as mãos estão depois da animação deste quadro. */
function encaixarInstrumentos({ vrm, instrumentos }: Modelo) {
  const { humanoid, scene } = vrm;
  const direita = humanoid.getRawBoneNode("rightHand");
  const esquerda = humanoid.getRawBoneNode("leftHand");
  const coxaDireita = humanoid.getRawBoneNode("rightUpperLeg");
  const coxaEsquerda = humanoid.getRawBoneNode("leftUpperLeg");
  const coluna = humanoid.getRawBoneNode("spine");
  if (!direita || !esquerda || !coxaDireita || !coxaEsquerda || !coluna) return;
  scene.updateMatrixWorld(true);
  const local = (osso: THREE.Object3D, destino: THREE.Vector3) => scene.worldToLocal(osso.getWorldPosition(destino));
  local(direita, maoDireita);
  local(esquerda, maoEsquerda);
  local(coluna, tronco);
  // A frente sai do esqueleto (da coxa direita para a esquerda, girado para cima), não do eixo da cena:
  // o VRM 0 vem virado 180° e a animação ainda gira o corpo.
  local(coxaEsquerda, frente).sub(local(coxaDireita, coxa)).cross(CIMA).normalize();
  for (const { objeto, osso } of instrumentos) if (osso === "maos") encaixarNasMaos(objeto, maoDireita, maoEsquerda, frente, tronco);
}

function descartarModelo(modelo: Modelo) {
  // Os instrumentos usam materiais compartilhados entre atores: saem antes de liberar o resto.
  for (const { objeto } of modelo.instrumentos) objeto.removeFromParent();
  modelo.mixer.stopAllAction();
  modelo.vrm.scene.removeFromParent();
  VRMUtils.deepDispose(modelo.vrm.scene);
}

function criarAtorVrm(estadoInicial: EstadoDoAvatar): Ator {
  const raiz = new THREE.Group();
  let estado = estadoInicial;
  let personagem = migrarPersonagem(estadoInicial.personagem);
  let modelo: Modelo | undefined;
  let carregando: string | undefined;
  let removido = false;
  const nascimento = performance.now();
  let ultimoPulso = -Infinity;
  const semente = Math.floor(Math.random() * 1000);
  let reacao: { tipo: TipoDeReacao; inicio: number; contador: number } | null = null;
  const comecarReacao = ({ tipo, contador }: Reacao) => (reacao = { tipo, contador, inicio: performance.now() });
  if (estadoInicial.reacao) comecarReacao(estadoInicial.reacao);

  async function carregar() {
    const chave = chaveDoModelo(personagem);
    carregando = chave;
    const vrm = await carregarVRM(chave);
    // Enquanto carregava, o ator pode ter saído da tela ou trocado de modelo.
    if (removido || carregando !== chave) {
      VRMUtils.deepDispose(vrm.scene);
      return;
    }
    if (modelo) descartarModelo(modelo);
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const descanso = mixer.clipAction(clipeDeDescanso(vrm)).play();
    mixer.update(0);
    vrm.update(0);
    const altura = new THREE.Box3().setFromObject(vrm.scene).max.y || 1.6;
    modelo = { vrm, mixer, descanso, acao: descanso, animacao: null, instrumentos: [], ajustador: criarAjustador(), chave, altura };
    trocarInstrumento(modelo, personagem);
    raiz.add(vrm.scene);
    carregando = undefined;
  }
  const iniciarCarga = () => void carregar().catch((erro) => console.error("[personagem]", erro));
  iniciarCarga();

  /** Troca a animação com transição suave quando o instrumento ou o estado de tocar mudam. */
  function escolherAnimacao(atual: Modelo) {
    const desejada = estado.tocando ? animacaoDoInstrumento(instrumentoDoPersonagem(personagem), semente) : null;
    if (desejada === atual.animacao) return;
    atual.animacao = desejada;
    const trocarPara = (acao: THREE.AnimationAction) => {
      if (modelo !== atual || atual.animacao !== desejada || acao === atual.acao) return;
      acao.reset().play();
      atual.acao.crossFadeTo(acao, TRANSICAO, false);
      atual.acao = acao;
    };
    if (!desejada) trocarPara(atual.descanso);
    else void animacaoParaVRM(desejada, atual.vrm).then((clipe) => trocarPara(atual.mixer.clipAction(clipe)));
  }

  return {
    raiz,
    altura: () => modelo?.altura ?? null,
    atualizar(novo) {
      if (novo.pulso !== estado.pulso) ultimoPulso = performance.now();
      if (novo.reacao && (novo.reacao.contador !== reacao?.contador || novo.reacao.tipo !== reacao?.tipo)) comecarReacao(novo.reacao);
      else if (!novo.reacao && reacao && estado.reacao) reacao = null;
      estado = novo;
      const atual = migrarPersonagem(novo.personagem);
      if (JSON.stringify(atual) === JSON.stringify(personagem)) return;
      personagem = atual;
      if (!modelo || chaveDoModelo(atual) !== modelo.chave) iniciarCarga();
    },
    reagir(tipo) {
      comecarReacao(novaReacao(reacao, tipo));
    },
    animar(agora, dt) {
      if (!modelo) return;
      const { vrm } = modelo;
      const tempo = (agora - nascimento) / 1000;
      escolherAnimacao(modelo);
      modelo.ajustador.desfazer();
      modelo.mixer.update(dt);
      const momento = reacaoDoAtor(reacao?.tipo ?? null, reacao ? (agora - reacao.inicio) / 1000 : 0);
      const ajustes = combinarAjustes(ajustesDaPose({ tempo, bpm: estado.bpm, tocando: estado.tocando, triste: estado.triste, comAnimacao: modelo.acao !== modelo.descanso }), momento.ossos);
      for (const [osso, rotacao] of Object.entries(ajustes)) {
        const no = vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName);
        if (no) modelo.ajustador.aplicar(no, rotacao);
      }
      const pesos = expressoesComReacao(pesosDasExpressoes({ triste: estado.triste, tempo, desdeOPulso: (agora - ultimoPulso) / 1000 }), momento.expressoes);
      for (const nome of EXPRESSOES_CONTROLADAS) vrm.expressionManager?.setValue(nome, pesos[nome] ?? 0);
      vrm.update(dt);
      encaixarInstrumentos(modelo);
    },
    descartar() {
      removido = true;
      if (modelo) descartarModelo(modelo);
      modelo = undefined;
    },
  };
}

/**
 * O personagem em cena: um VRM 3D ou uma pessoa filmada, conforme o modelo escolhido.
 * Trocar entre os dois tipos (na tela de Personagem) monta o ator certo no lugar.
 */
export function criarAtor(estadoInicial: EstadoDoAvatar): Ator {
  const raiz = new THREE.Group();
  let atual: Ator;
  let chave = "";
  const chaveDe = (estado: EstadoDoAvatar) => {
    const skin = skinDoPersonagem(migrarPersonagem(estado.personagem));
    return skin.tipo === "video" ? `video:${skin.arquivo}` : "vrm";
  };
  const montar = (estado: EstadoDoAvatar) => {
    atual?.descartar();
    atual?.raiz.removeFromParent();
    chave = chaveDe(estado);
    atual = chave === "vrm" ? criarAtorVrm(estado) : criarAtorDeVideo(estado);
    raiz.add(atual.raiz);
  };
  montar(estadoInicial);
  return {
    raiz,
    altura: () => atual.altura(),
    atualizar(novo) {
      if (chaveDe(novo) !== chave) montar(novo);
      else atual.atualizar(novo);
    },
    reagir: (tipo) => atual.reagir(tipo),
    animar: (agora, dt) => atual.animar(agora, dt),
    descartar: () => atual.descartar(),
  };
}
