import * as THREE from "three";
import { VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { POSE_DE_DESCANSO, ajustesDaPose, animacaoDoInstrumento } from "../animacao";
import { pesosDasExpressoes } from "../aparencia";
import { BASES, PECAS } from "../catalogo";
import { migrarPersonagem, type Personagem } from "../personagem";
import { criarInstrumento } from "./instrumentos";
import { animacaoParaVRM, aplicarCores, aplicarCorpo, carregarPeca, carregarVRM, vestirPeca } from "./vrm";

export interface EstadoDoAvatar {
  personagem: Personagem;
  tocando: boolean;
  bpm: number;
  pulso: number;
  triste: boolean;
}

/**
 * O personagem VRM vivo: carrega o modelo, veste as peças, troca as animações compartilhadas
 * com transição e aplica expressões e customização. Quem usa só precisa pôr `raiz` numa cena
 * e chamar `animar` a cada quadro (a tela de Personagem, os avatares do HUD, o palco).
 */
export interface Ator {
  raiz: THREE.Group;
  atualizar(estado: EstadoDoAvatar): void;
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
  instrumentos: THREE.Object3D[];
  /** O que exige recarregar o modelo inteiro quando muda. */
  chave: string;
  altura: number;
}

const TRANSICAO = 0.4;
const EXPRESSOES_CONTROLADAS = ["happy", "sad", "angry", "relaxed", "blink"];
const euler = new THREE.Euler();
const ajuste = new THREE.Quaternion();

const chaveDoModelo = (p: Personagem) => `${p.base}|${p.pecas.join(",")}`;
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
  for (const objeto of modelo.instrumentos) objeto.removeFromParent();
  modelo.instrumentos = criarInstrumento(personagem.instrumento).map(({ objeto, osso }) => {
    modelo.vrm.humanoid.getNormalizedBoneNode(osso)?.add(objeto);
    return objeto;
  });
}

function descartarModelo(modelo: Modelo) {
  // Os instrumentos usam materiais compartilhados entre atores: saem antes de liberar o resto.
  for (const objeto of modelo.instrumentos) objeto.removeFromParent();
  modelo.mixer.stopAllAction();
  modelo.vrm.scene.removeFromParent();
  VRMUtils.deepDispose(modelo.vrm.scene);
}

export function criarAtor(estadoInicial: EstadoDoAvatar): Ator {
  const raiz = new THREE.Group();
  let estado = estadoInicial;
  let personagem = migrarPersonagem(estadoInicial.personagem);
  let modelo: Modelo | undefined;
  let carregando: string | undefined;
  let removido = false;
  const nascimento = performance.now();
  let ultimoPulso = -Infinity;
  const semente = Math.floor(Math.random() * 1000);

  async function carregar() {
    const chave = chaveDoModelo(personagem);
    carregando = chave;
    const base = BASES.find((b) => b.id === personagem.base) ?? BASES[0];
    const vrm = await carregarVRM(base.arquivo);
    for (const id of personagem.pecas) {
      const peca = PECAS.find((p) => p.id === id);
      if (peca) vestirPeca(vrm.scene, await carregarPeca(peca.arquivo), peca.cobre);
    }
    // Enquanto carregava, o ator pode ter saído da tela ou trocado de modelo.
    if (removido || carregando !== chave) {
      VRMUtils.deepDispose(vrm.scene);
      return;
    }
    if (modelo) descartarModelo(modelo);
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const descanso = mixer.clipAction(clipeDeDescanso(vrm)).play();
    aplicarCores(vrm.scene, personagem.cores);
    aplicarCorpo(vrm, personagem.corpo);
    mixer.update(0);
    vrm.update(0);
    const altura = new THREE.Box3().setFromObject(vrm.scene).max.y || 1.6;
    modelo = { vrm, mixer, descanso, acao: descanso, animacao: null, instrumentos: [], chave, altura };
    trocarInstrumento(modelo, personagem);
    raiz.add(vrm.scene);
    carregando = undefined;
  }
  const iniciarCarga = () => void carregar().catch((erro) => console.error("[personagem]", erro));
  iniciarCarga();

  /** Troca a animação com transição suave quando o instrumento ou o estado de tocar mudam. */
  function escolherAnimacao(atual: Modelo) {
    const desejada = estado.tocando ? animacaoDoInstrumento(personagem.instrumento, semente) : null;
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
      estado = novo;
      const anterior = personagem;
      const atual = migrarPersonagem(novo.personagem);
      if (JSON.stringify(atual) === JSON.stringify(anterior)) return;
      personagem = atual;
      if (!modelo || chaveDoModelo(atual) !== modelo.chave) return iniciarCarga();
      // Cores, corpo e instrumento mudam na hora, sem recarregar o modelo.
      aplicarCores(modelo.vrm.scene, atual.cores);
      aplicarCorpo(modelo.vrm, atual.corpo);
      if (atual.instrumento !== anterior.instrumento) trocarInstrumento(modelo, atual);
    },
    animar(agora, dt) {
      if (!modelo) return;
      const { vrm } = modelo;
      const tempo = (agora - nascimento) / 1000;
      escolherAnimacao(modelo);
      modelo.mixer.update(dt);
      const ajustes = ajustesDaPose({ tempo, bpm: estado.bpm, tocando: estado.tocando, triste: estado.triste, comAnimacao: modelo.acao !== modelo.descanso });
      for (const [osso, [x, y, z]] of Object.entries(ajustes)) {
        vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName)?.quaternion.multiply(ajuste.setFromEuler(euler.set(x, y, z)));
      }
      const pesos = pesosDasExpressoes({ expressao: personagem.expressao, triste: estado.triste, tempo, desdeOPulso: (agora - ultimoPulso) / 1000 });
      for (const nome of EXPRESSOES_CONTROLADAS) vrm.expressionManager?.setValue(nome, pesos[nome] ?? 0);
      vrm.update(dt);
    },
    descartar() {
      removido = true;
      if (modelo) descartarModelo(modelo);
      modelo = undefined;
    },
  };
}
