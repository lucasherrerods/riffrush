import * as THREE from "three";
import { criarAtor, type EstadoDoAvatar } from "@/modules/character";
import { cores } from "@/shared/styles/tokens";
import { luzesDoPalco, planoDaCamera } from "./direcao";

/** O que o palco lê a cada quadro, vindo da partida. */
export interface EstadoDoPalco extends EstadoDoAvatar {
  /** Tempo da música em segundos (negativo durante a contagem). */
  tempo: number;
  /** Duração da contagem, em segundos. */
  entrada: number;
  estrelaAtiva: boolean;
  /** Segundos desde o último trovão de combo. */
  desdeTrovao: number;
}

/** 30 quadros por segundo e meia resolução: o palco é fundo, a GPU fica para a pista. */
const INTERVALO_ENTRE_QUADROS = 1000 / 30;
const RESOLUCAO = 0.6;
const HOLOFOTES = [
  { x: -4, cor: cores.primaria },
  { x: -1.4, cor: cores.texto },
  { x: 1.4, cor: cores.destaque },
  { x: 4, cor: cores.primaria },
];
const ALTURA_DA_TRELICA = 5;

function toon(cor: string) {
  return new THREE.MeshToonMaterial({ color: cor });
}

/** Telão do fundo com o desenho da logo: anel creme gasto e dois raios vermelhos. */
function texturaDoTelao() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.fillStyle = cores.fundo;
  c.fillRect(0, 0, 1024, 512);
  c.strokeStyle = cores.texto;
  c.globalAlpha = 0.5;
  c.lineWidth = 34;
  c.beginPath();
  c.arc(512, 256, 170, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = 1;
  c.fillStyle = cores.primaria;
  for (const [x, espelho] of [
    [250, 1],
    [774, -1],
  ]) {
    c.save();
    c.translate(x, 70);
    c.scale(espelho * 2.6, 3.6);
    c.beginPath();
    for (const [i, [px, py]] of [
      [58, 0],
      [22, 52],
      [44, 50],
      [8, 100],
      [78, 38],
      [54, 40],
      [86, 0],
    ].entries()) {
      if (i === 0) c.moveTo(px - 47, py);
      else c.lineTo(px - 47, py);
    }
    c.fill();
    c.restore();
  }
  // Falhas da tinta, como na logo.
  for (let i = 0; i < 2500; i++) {
    c.fillStyle = cores.fundo;
    c.globalAlpha = Math.random() * 0.8;
    c.fillRect(Math.random() * 1024, Math.random() * 512, 2 + Math.random() * 4, 2 + Math.random() * 3);
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function montarCenario(cena: THREE.Scene) {
  const tablado = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 6), toon(cores.superficie));
  tablado.position.set(0, -0.2, 0);
  const borda = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: cores.primaria }));
  borda.position.set(0, 0.01, 3);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), toon(cores.fundo));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -0.4;
  cena.add(tablado, borda, chao);

  const textura = texturaDoTelao();
  const telao = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: textura, color: "#ffffff" }));
  telao.position.set(0, 3.2, -3.5);
  cena.add(telao);

  const metal = toon(cores.borda);
  const barra = (largura: number, altura: number, x: number, y: number) => {
    const malha = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, 0.25), metal);
    malha.position.set(x, y, 0.8);
    cena.add(malha);
  };
  barra(12, 0.25, 0, ALTURA_DA_TRELICA);
  barra(0.25, ALTURA_DA_TRELICA, -6, ALTURA_DA_TRELICA / 2);
  barra(0.25, ALTURA_DA_TRELICA, 6, ALTURA_DA_TRELICA / 2);

  // Pilhas de caixas de som nas laterais.
  for (const lado of [-1, 1]) {
    for (let andar = 0; andar < 2; andar++) {
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.9), toon(cores.superficieElevada));
      caixa.position.set(lado * 4.6, 0.55 + andar * 1.12, -1.6);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), toon(cores.fundo));
      cone.position.set(0, 0, 0.451);
      caixa.add(cone);
      cena.add(caixa);
    }
  }
  return telao.material;
}

/** Holofote com cone de luz visível, preso na treliça e mirando o personagem. */
function criarHolofote(cena: THREE.Scene, x: number, cor: string) {
  const luz = new THREE.SpotLight(cor, 0, 14, 0.32, 0.5, 1.2);
  luz.position.set(x, ALTURA_DA_TRELICA - 0.2, 1.2);
  luz.target.position.set(0, 0, 0);
  const altura = 6;
  const geometria = new THREE.ConeGeometry(1.6, altura, 32, 1, true).translate(0, -altura / 2, 0).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixe = new THREE.Mesh(geometria, material);
  feixe.position.copy(luz.position);
  cena.add(luz, luz.target, feixe);
  return { luz, feixe, material, cor: new THREE.Color(cor) };
}

/**
 * Palco 3D atrás da pista: o personagem, telão, treliça, caixas de som e holofotes que
 * pulsam no ritmo, clareiam nos trovões de combo e ficam azuis no star power.
 */
export function criarPalco(canvas: HTMLCanvasElement, lerEstado: () => EstadoDoPalco, { comPersonagem = true } = {}) {
  const renderizador = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderizador.setPixelRatio(RESOLUCAO);
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(cores.fundo);
  cena.fog = new THREE.Fog(cores.fundo, 9, 24);
  const ambiente = new THREE.AmbientLight("#ffffff", 0.35);
  const frente = new THREE.DirectionalLight("#fff4e6", 0.6);
  frente.position.set(0, 3, 6);
  cena.add(ambiente, frente);
  const materialDoTelao = montarCenario(cena);
  const holofotes = HOLOFOTES.map(({ x, cor }) => criarHolofote(cena, x, cor));
  const corDaEstrela = new THREE.Color(cores.estrela);
  const branco = new THREE.Color(cores.texto);

  const ator = comPersonagem ? criarAtor(lerEstado()) : null;
  if (ator) cena.add(ator.raiz);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 60);

  let quadro = 0;
  let ultimoQuadro = 0;
  const desenhar = (agora: number) => {
    quadro = requestAnimationFrame(desenhar);
    if (agora - ultimoQuadro < INTERVALO_ENTRE_QUADROS) return;
    const dt = Math.min(0.1, (agora - ultimoQuadro) / 1000);
    ultimoQuadro = agora;

    const estado = lerEstado();
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    if (!largura || !altura) return;
    const tamanho = renderizador.getSize(new THREE.Vector2());
    if (tamanho.x !== largura || tamanho.y !== altura) renderizador.setSize(largura, altura, false);

    ator?.atualizar(estado);
    ator?.animar(agora, dt);

    const plano = planoDaCamera(estado.tempo, estado.entrada, ator?.altura() ?? 1.6);
    camera.aspect = largura / altura;
    camera.position.set(...plano.posicao);
    camera.lookAt(...plano.alvo);
    camera.updateProjectionMatrix();

    const luzes = luzesDoPalco({ tempo: estado.tempo, bpm: estado.bpm, desdeTrovao: estado.desdeTrovao, estrelaAtiva: estado.estrelaAtiva });
    holofotes.forEach((holofote, i) => {
      const cor = luzes.cor === "estrela" ? corDaEstrela : holofote.cor;
      const tom = cor.clone().lerp(branco, luzes.clarao);
      holofote.luz.color.copy(tom);
      holofote.material.color.copy(tom);
      holofote.luz.intensity = (40 + 120 * luzes.clarao) * luzes.intensidade * luzes.foco;
      holofote.material.opacity = (0.05 + 0.12 * luzes.clarao) * luzes.intensidade * luzes.foco + 0.02;
      // Os holofotes varrem o palco, cada um no seu ritmo.
      const alvo = new THREE.Vector3(Math.sin(estado.tempo * 0.7 + i * 1.7) * 1.8, 0, Math.cos(estado.tempo * 0.5 + i) * 0.8);
      holofote.luz.target.position.copy(alvo);
      holofote.feixe.lookAt(alvo);
    });
    ambiente.intensity = 0.25 + 0.9 * luzes.clarao;
    // O telão acompanha o ritmo, mas tocando fica baixo para não disputar com as notas.
    materialDoTelao.color.setScalar((0.15 + 0.5 * luzes.intensidade) * (luzes.foco < 1 ? 0.55 : 1) + luzes.clarao * 0.35);

    renderizador.render(cena, camera);
  };
  quadro = requestAnimationFrame(desenhar);

  return {
    descartar() {
      cancelAnimationFrame(quadro);
      ator?.descartar();
      cena.traverse((objeto) => {
        if (objeto instanceof THREE.Mesh) {
          objeto.geometry.dispose();
          (objeto.material as THREE.Material).dispose();
        }
      });
      renderizador.dispose();
    },
  };
}
