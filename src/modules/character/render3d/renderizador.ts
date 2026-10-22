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
}

interface Avatar {
  destino: HTMLCanvasElement;
  cena: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  estado: EstadoDoAvatar;
  personagem: Personagem;
  nascimento: number;
  ultimoPulso: number;
  semente: number;
  modelo?: Modelo;
  carregando?: string;
  removido: boolean;
}

/** 30 quadros por segundo bastam para o personagem e deixam a GPU para a pista. */
const INTERVALO_ENTRE_QUADROS = 1000 / 30;
const CAMPO_DE_VISAO = 24;
const TRANSICAO = 0.4;
const EXPRESSOES_CONTROLADAS = ["happy", "sad", "angry", "relaxed", "blink"];

let renderizador: THREE.WebGLRenderer | undefined;
const avatares = new Set<Avatar>();
let quadro = 0;
let ultimoQuadro = 0;
const euler = new THREE.Euler();
const ajuste = new THREE.Quaternion();

export function suportaWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

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

function enquadrar(avatar: Avatar, vrm: VRM) {
  const altura = new THREE.Box3().setFromObject(vrm.scene).max.y || 1.6;
  const distancia = (altura * 0.62) / Math.tan(THREE.MathUtils.degToRad(CAMPO_DE_VISAO / 2));
  avatar.camera.position.set(0, altura * 0.55, distancia);
  avatar.camera.lookAt(0, altura * 0.5, 0);
}

function descartar(modelo: Modelo) {
  // Os instrumentos usam materiais compartilhados entre avatares: saem antes de liberar o resto.
  for (const objeto of modelo.instrumentos) objeto.removeFromParent();
  modelo.mixer.stopAllAction();
  modelo.vrm.scene.removeFromParent();
  VRMUtils.deepDispose(modelo.vrm.scene);
}

async function carregarModelo(avatar: Avatar) {
  const personagem = avatar.personagem;
  const chave = chaveDoModelo(personagem);
  avatar.carregando = chave;
  const base = BASES.find((b) => b.id === personagem.base) ?? BASES[0];
  const vrm = await carregarVRM(base.arquivo);
  for (const id of personagem.pecas) {
    const peca = PECAS.find((p) => p.id === id);
    if (peca) vestirPeca(vrm.scene, await carregarPeca(peca.arquivo), peca.cobre);
  }
  // Enquanto carregava, o avatar pode ter saído da tela ou trocado de modelo.
  if (avatar.removido || avatar.carregando !== chave) {
    VRMUtils.deepDispose(vrm.scene);
    return;
  }

  if (avatar.modelo) descartar(avatar.modelo);
  // Três quartos de perfil, como nas telas de personagem de RPG.
  vrm.scene.rotation.y = -0.35;
  const mixer = new THREE.AnimationMixer(vrm.scene);
  const descanso = mixer.clipAction(clipeDeDescanso(vrm)).play();
  const modelo: Modelo = { vrm, mixer, descanso, acao: descanso, animacao: null, instrumentos: [], chave };
  aplicarCores(vrm.scene, personagem.cores);
  aplicarCorpo(vrm, personagem.corpo);
  trocarInstrumento(modelo, personagem);
  avatar.cena.add(vrm.scene);
  avatar.modelo = modelo;
  avatar.carregando = undefined;
  mixer.update(0);
  vrm.update(0);
  enquadrar(avatar, vrm);
}

/** Troca a animação com transição suave quando o instrumento ou o estado de tocar mudam. */
function escolherAnimacao(avatar: Avatar, modelo: Modelo) {
  const desejada = avatar.estado.tocando ? animacaoDoInstrumento(avatar.personagem.instrumento, avatar.semente) : null;
  if (desejada === modelo.animacao) return;
  modelo.animacao = desejada;
  const trocarPara = (acao: THREE.AnimationAction) => {
    if (avatar.modelo !== modelo || modelo.animacao !== desejada || acao === modelo.acao) return;
    acao.reset().play();
    modelo.acao.crossFadeTo(acao, TRANSICAO, false);
    modelo.acao = acao;
  };
  if (!desejada) trocarPara(modelo.descanso);
  else void animacaoParaVRM(desejada, modelo.vrm).then((clipe) => trocarPara(modelo.mixer.clipAction(clipe)));
}

function animar(avatar: Avatar, modelo: Modelo, agora: number, dt: number) {
  const { vrm } = modelo;
  const { estado, personagem } = avatar;
  const tempo = (agora - avatar.nascimento) / 1000;
  escolherAnimacao(avatar, modelo);
  modelo.mixer.update(dt);

  const ajustes = ajustesDaPose({ tempo, bpm: estado.bpm, tocando: estado.tocando, triste: estado.triste, comAnimacao: modelo.acao !== modelo.descanso });
  for (const [osso, [x, y, z]] of Object.entries(ajustes)) {
    vrm.humanoid.getNormalizedBoneNode(osso as VRMHumanBoneName)?.quaternion.multiply(ajuste.setFromEuler(euler.set(x, y, z)));
  }

  const pesos = pesosDasExpressoes({ expressao: personagem.expressao, triste: estado.triste, tempo, desdeOPulso: (agora - avatar.ultimoPulso) / 1000 });
  for (const nome of EXPRESSOES_CONTROLADAS) vrm.expressionManager?.setValue(nome, pesos[nome] ?? 0);
  vrm.update(dt);
}

function desenhar(agora: number) {
  quadro = requestAnimationFrame(desenhar);
  if (!renderizador || agora - ultimoQuadro < INTERVALO_ENTRE_QUADROS) return;
  const dt = Math.min(0.1, (agora - ultimoQuadro) / 1000);
  ultimoQuadro = agora;

  for (const avatar of avatares) {
    const { destino, modelo } = avatar;
    if (!modelo) continue;
    const proporcao = Math.min(window.devicePixelRatio || 1, 2);
    const largura = Math.round(destino.clientWidth * proporcao);
    const altura = Math.round(destino.clientHeight * proporcao);
    if (!largura || !altura) continue;
    if (destino.width !== largura || destino.height !== altura) {
      destino.width = largura;
      destino.height = altura;
    }
    const tamanho = renderizador.getSize(new THREE.Vector2());
    if (tamanho.x < largura || tamanho.y < altura) renderizador.setSize(Math.max(tamanho.x, largura), Math.max(tamanho.y, altura), false);

    animar(avatar, modelo, agora, dt);

    // Todos os avatares usam o mesmo contexto WebGL: cada um é desenhado num canto do buffer e copiado para o seu canvas.
    const alturaDoBuffer = renderizador.getSize(new THREE.Vector2()).y;
    avatar.camera.aspect = largura / altura;
    avatar.camera.updateProjectionMatrix();
    renderizador.setViewport(0, 0, largura, altura);
    renderizador.setScissor(0, 0, largura, altura);
    renderizador.setScissorTest(true);
    renderizador.clear();
    renderizador.render(avatar.cena, avatar.camera);
    const contexto = destino.getContext("2d");
    if (!contexto) continue;
    contexto.clearRect(0, 0, largura, altura);
    contexto.drawImage(renderizador.domElement, 0, alturaDoBuffer - altura, largura, altura, 0, 0, largura, altura);
  }
}

function criarCena() {
  const cena = new THREE.Scene();
  cena.add(new THREE.AmbientLight("#ffffff", 1.2));
  const principal = new THREE.DirectionalLight("#fff4e6", 2.4);
  principal.position.set(1.5, 2.5, 3);
  cena.add(principal);
  return cena;
}

/** Registra um canvas para receber o avatar. Devolve funções para atualizar o estado e remover. */
export function registrarAvatar(destino: HTMLCanvasElement, estado: EstadoDoAvatar) {
  renderizador ??= new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderizador.setClearColor(0x000000, 0);

  const personagem = migrarPersonagem(estado.personagem);
  const avatar: Avatar = {
    destino,
    cena: criarCena(),
    camera: new THREE.PerspectiveCamera(CAMPO_DE_VISAO, 3 / 4, 0.1, 20),
    estado,
    personagem,
    nascimento: performance.now(),
    ultimoPulso: -Infinity,
    semente: Math.floor(Math.random() * 1000),
    removido: false,
  };
  avatares.add(avatar);
  void carregarModelo(avatar).catch((erro) => console.error("[personagem]", erro));
  if (!quadro) quadro = requestAnimationFrame(desenhar);

  return {
    atualizar(novo: EstadoDoAvatar) {
      if (novo.pulso !== avatar.estado.pulso) avatar.ultimoPulso = performance.now();
      avatar.estado = novo;
      const anterior = avatar.personagem;
      const atual = migrarPersonagem(novo.personagem);
      if (JSON.stringify(atual) === JSON.stringify(anterior)) return;
      avatar.personagem = atual;
      const { modelo } = avatar;
      if (!modelo || chaveDoModelo(atual) !== modelo.chave) {
        void carregarModelo(avatar).catch((erro) => console.error("[personagem]", erro));
        return;
      }
      // Cores, corpo e instrumento mudam na hora, sem recarregar o modelo.
      aplicarCores(modelo.vrm.scene, atual.cores);
      aplicarCorpo(modelo.vrm, atual.corpo);
      if (atual.instrumento !== anterior.instrumento) trocarInstrumento(modelo, atual);
    },
    remover() {
      avatar.removido = true;
      avatares.delete(avatar);
      if (avatar.modelo) descartar(avatar.modelo);
      if (!avatares.size) {
        cancelAnimationFrame(quadro);
        quadro = 0;
      }
    },
  };
}
