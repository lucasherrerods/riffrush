import * as THREE from "three";
import { CORES_DA_CENA } from "@/modules/rock/tema";
import { criarAtor, type Ator, type EstadoDoAvatar } from "./ator";

export type { EstadoDoAvatar } from "./ator";

interface Avatar {
  destino: HTMLCanvasElement;
  cena: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ator: Ator;
  enquadrado: boolean;
}

/** 30 quadros por segundo bastam para o personagem e deixam a GPU para a pista. */
const INTERVALO_ENTRE_QUADROS = 1000 / 30;
const CAMPO_DE_VISAO = 24;

let renderizador: THREE.WebGLRenderer | undefined;
const avatares = new Set<Avatar>();
let quadro = 0;
let ultimoQuadro = 0;

/** Corpo inteiro no quadro, olhando para o meio do personagem. */
function enquadrar(camera: THREE.PerspectiveCamera, altura: number) {
  const distancia = (altura * 0.62) / Math.tan(THREE.MathUtils.degToRad(CAMPO_DE_VISAO / 2));
  camera.position.set(0, altura * 0.55, distancia);
  camera.lookAt(0, altura * 0.5, 0);
}

function desenhar(agora: number) {
  quadro = requestAnimationFrame(desenhar);
  if (!renderizador || agora - ultimoQuadro < INTERVALO_ENTRE_QUADROS) return;
  const dt = Math.min(0.1, (agora - ultimoQuadro) / 1000);
  ultimoQuadro = agora;

  for (const avatar of avatares) {
    const { destino, ator } = avatar;
    const alturaDoModelo = ator.altura();
    if (alturaDoModelo === null) continue;
    if (!avatar.enquadrado) {
      enquadrar(avatar.camera, alturaDoModelo);
      avatar.enquadrado = true;
    }
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

    ator.animar(agora, dt);

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
  cena.add(new THREE.AmbientLight(CORES_DA_CENA.luz, 1.2));
  const principal = new THREE.DirectionalLight(CORES_DA_CENA.luzQuente, 2.4);
  principal.position.set(1.5, 2.5, 3);
  cena.add(principal);
  return cena;
}

/** Registra um canvas para receber o avatar. Devolve funções para atualizar o estado e remover. */
export function registrarAvatar(destino: HTMLCanvasElement, estado: EstadoDoAvatar) {
  renderizador ??= new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderizador.setClearColor(0x000000, 0);

  const ator = criarAtor(estado);
  // Três quartos de perfil, como nas telas de personagem de RPG.
  ator.raiz.rotation.y = -0.35;
  const cena = criarCena();
  cena.add(ator.raiz);
  const avatar: Avatar = { destino, cena, camera: new THREE.PerspectiveCamera(CAMPO_DE_VISAO, 3 / 4, 0.1, 20), ator, enquadrado: false };
  avatares.add(avatar);
  if (!quadro) quadro = requestAnimationFrame(desenhar);

  return {
    atualizar: (novo: EstadoDoAvatar) => ator.atualizar(novo),
    remover() {
      avatares.delete(avatar);
      ator.descartar();
      if (!avatares.size) {
        cancelAnimationFrame(quadro);
        quadro = 0;
      }
    },
  };
}
