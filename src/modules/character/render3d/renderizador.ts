import * as THREE from "three";
import { montarPersonagem, type Montagem } from "../montagem";
import type { Personagem } from "../personagem";
import { calcularPose } from "../pose";
import { aplicarPose, construirCorpo, type Esqueleto } from "./corpo";

export interface EstadoDoAvatar {
  personagem: Personagem;
  tocando: boolean;
  bpm: number;
  pulso: number;
  triste: boolean;
}

interface Avatar {
  destino: HTMLCanvasElement;
  cena: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  montagem: Montagem;
  esqueleto: Esqueleto;
  estado: EstadoDoAvatar;
  nascimento: number;
  ultimoPulso: number;
}

/** 30 quadros por segundo bastam para o personagem e deixam a GPU para a pista. */
const INTERVALO_ENTRE_QUADROS = 1000 / 30;
const CAMPO_DE_VISAO = 24;

let renderizador: THREE.WebGLRenderer | undefined;
const avatares = new Set<Avatar>();
let quadro = 0;
let ultimoQuadro = 0;

export function suportaWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function criarCena(montagem: Montagem) {
  const cena = new THREE.Scene();
  cena.add(new THREE.AmbientLight("#ffffff", 0.9));
  const principal = new THREE.DirectionalLight("#fff4e6", 2.2);
  principal.position.set(2, 3, 4);
  cena.add(principal);

  const esqueleto = construirCorpo(montagem);
  // Três quartos de perfil, como nas telas de personagem de RPG.
  esqueleto.raiz.rotation.y = -0.35;
  cena.add(esqueleto.raiz);

  const altura = montagem.medidas.altura;
  const camera = new THREE.PerspectiveCamera(CAMPO_DE_VISAO, 3 / 4, 0.1, 20);
  const distancia = (altura * 0.62) / Math.tan(THREE.MathUtils.degToRad(CAMPO_DE_VISAO / 2));
  camera.position.set(0, altura * 0.55, distancia);
  camera.lookAt(0, altura * 0.5, 0);
  return { cena, camera, esqueleto };
}

function liberar(cena: THREE.Scene) {
  // Materiais são compartilhados entre avatares; só as geometrias são de cada um.
  cena.traverse((objeto) => {
    if (objeto instanceof THREE.Mesh) objeto.geometry.dispose();
  });
}

function desenhar(agora: number) {
  quadro = requestAnimationFrame(desenhar);
  if (!renderizador || agora - ultimoQuadro < INTERVALO_ENTRE_QUADROS) return;
  ultimoQuadro = agora;

  for (const avatar of avatares) {
    const { destino } = avatar;
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

    const { estado } = avatar;
    const tempo = (agora - avatar.nascimento) / 1000;
    const pose = calcularPose({
      tempo,
      bpm: estado.bpm,
      desdeOPulso: (agora - avatar.ultimoPulso) / 1000,
      tocando: estado.tocando,
      triste: estado.triste,
      instrumento: avatar.montagem.pecas.instrumento,
    });
    aplicarPose(avatar.esqueleto, avatar.montagem, pose);

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

/** Registra um canvas para receber o avatar. Devolve funções para atualizar o estado e remover. */
export function registrarAvatar(destino: HTMLCanvasElement, estado: EstadoDoAvatar) {
  renderizador ??= new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderizador.setClearColor(0x000000, 0);

  const montar = (personagem: Personagem) => {
    const montagem = montarPersonagem(personagem);
    return { montagem, ...criarCena(montagem) };
  };
  const agora = performance.now();
  const avatar: Avatar = { destino, estado, nascimento: agora, ultimoPulso: -Infinity, ...montar(estado.personagem) };
  avatares.add(avatar);
  if (!quadro) quadro = requestAnimationFrame(desenhar);

  return {
    atualizar(novo: EstadoDoAvatar) {
      if (novo.pulso !== avatar.estado.pulso) avatar.ultimoPulso = performance.now();
      if (JSON.stringify(novo.personagem) !== JSON.stringify(avatar.estado.personagem)) {
        liberar(avatar.cena);
        Object.assign(avatar, montar(novo.personagem));
      }
      avatar.estado = novo;
    },
    remover() {
      avatares.delete(avatar);
      liberar(avatar.cena);
      if (!avatares.size) {
        cancelAnimationFrame(quadro);
        quadro = 0;
      }
    },
  };
}
