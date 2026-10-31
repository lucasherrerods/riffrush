import * as THREE from "three";
import type { Ator, EstadoDoAvatar } from "@/modules/rock/character";
import { CORES_DA_CENA, CORES_DOS_INSTRUMENTOS, cores } from "@/modules/rock/tema";
import { luzesDoPalco, planoDaCamera } from "./direcao";
import { ajustesDoPalco, type QualidadeDoPalco } from "./qualidade";

/** O que o palco lê a cada quadro, vindo da partida. */
export interface EstadoDoPalco extends EstadoDoAvatar {
  /** Tempo da música em segundos (negativo durante a contagem). */
  tempo: number;
  /** Duração da contagem, em segundos. */
  entrada: number;
  estrelaAtiva: boolean;
  /** Segundos desde o último trovão de combo. */
  desdeTrovao: number;
  sequencia: number;
  multiplicador: number;
  /** Falhou ou a música acabou: as luzes do show apagam. */
  apagando: boolean;
}

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
  const telao = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: textura, color: CORES_DA_CENA.telao }));
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

/** Silhueta de músico desenhada num plano: corpo, cabeça e instrumento, sem rosto, para não disputar com o personagem. */
function texturaDeMusico(instrumento: "guitarra" | "baixo") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.fillStyle = CORES_DA_CENA.contorno;
  c.beginPath();
  c.arc(128, 70, 34, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(78, 120);
  c.lineTo(178, 120);
  c.lineTo(168, 300);
  c.lineTo(190, 500);
  c.lineTo(146, 500);
  c.lineTo(128, 340);
  c.lineTo(110, 500);
  c.lineTo(66, 500);
  c.lineTo(88, 300);
  c.closePath();
  c.fill();
  // Braço do instrumento atravessando o corpo; o baixo é mais comprido.
  c.save();
  c.translate(128, 260);
  c.rotate(-0.5);
  c.fillRect(-20, -6, instrumento === "baixo" ? 200 : 160, 12);
  c.beginPath();
  c.ellipse(-30, 0, 46, 34, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Banda de apoio no fundo: bateria ao centro, guitarrista e baixista nas laterais, amplificadores atrás deles. */
function montarBanda(cena: THREE.Scene) {
  const preto = toon(CORES_DOS_INSTRUMENTOS.preto);
  const metal = toon(CORES_DOS_INSTRUMENTOS.metal);
  const bateria = new THREE.Group();
  const bumbo = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 24).rotateX(Math.PI / 2), preto);
  bumbo.position.set(0, 0.42, 0);
  const pele = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), toon(CORES_DOS_INSTRUMENTOS.marfim));
  pele.position.set(0, 0.42, 0.205);
  bateria.add(bumbo, pele);
  for (const [x, y, raio] of [
    [-0.55, 0.7, 0.2],
    [0.55, 0.7, 0.22],
    [-0.25, 0.95, 0.16],
    [0.25, 0.95, 0.16],
  ]) {
    const tambor = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, 0.22, 20), preto);
    tambor.position.set(x, y, 0.1);
    bateria.add(tambor);
  }
  const pratos: THREE.Mesh[] = [];
  for (const x of [-0.85, 0.9]) {
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), metal);
    haste.position.set(x, 0.7, 0);
    const prato = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 24), toon(CORES_DOS_INSTRUMENTOS.madeira));
    prato.position.set(x, 1.4, 0);
    bateria.add(haste, prato);
    pratos.push(prato);
  }
  // Tablado elevado da bateria, no fundo.
  const praticavel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.6), toon(cores.superficieElevada));
  praticavel.position.set(0, -0.2, 0);
  bateria.add(praticavel);
  bateria.position.set(0.6, 0.4, -2.6);
  cena.add(bateria);

  // Cabeçotes e caixas dos amplificadores atrás de cada músico.
  for (const x of [-3.2, 3.2]) {
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.5), preto);
    caixa.position.set(x, 0.5, -2.2);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), toon(cores.superficie));
    tela.position.set(0, 0, 0.251);
    const cabecote = new THREE.Mesh(new THREE.BoxGeometry(1, 0.32, 0.45), preto);
    cabecote.position.set(0, 0.66, 0);
    const painel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.08), toon(CORES_DOS_INSTRUMENTOS.marfim));
    painel.position.set(0, 0.66, 0.226);
    caixa.add(tela, cabecote, painel);
    cena.add(caixa);
  }

  const musicos = (["guitarra", "baixo"] as const).map((instrumento, i) => {
    const material = new THREE.MeshBasicMaterial({ map: texturaDeMusico(instrumento), transparent: true, depthWrite: false });
    const musico = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7), material);
    musico.position.set(i === 0 ? -3.4 : 3.3, 0.85, -1.4);
    cena.add(musico);
    return musico;
  });

  /** Os músicos balançam na batida e os pratos tremem; tudo devagar para não chamar mais atenção que a pista. */
  return (tempo: number, bpm: number) => {
    const fase = (tempo * Math.max(40, bpm)) / 60;
    musicos.forEach((musico, i) => {
      musico.rotation.z = Math.sin(fase * Math.PI + i * 1.3) * 0.06;
      musico.position.y = 0.85 + Math.abs(Math.sin(fase * Math.PI + i)) * 0.04;
    });
    pratos.forEach((prato, i) => {
      prato.rotation.x = Math.sin(fase * Math.PI * 2 + i) * 0.08;
    });
  };
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
interface OpcoesDoPalco {
  /** Sem ele, o palco fica sem o personagem. */
  criarAtor?: (estado: EstadoDoAvatar) => Ator;
  qualidade?: QualidadeDoPalco;
  /** Desenha só o personagem e as luzes, com fundo transparente, para ficar por cima do vídeo do show. */
  soPersonagem?: boolean;
}

export function criarPalco(canvas: HTMLCanvasElement, lerEstado: () => EstadoDoPalco, { criarAtor, qualidade = "media", soPersonagem = false }: OpcoesDoPalco = {}) {
  // O palco é fundo: menos resolução e quadros que a pista deixam a GPU para ela.
  const { resolucao, quadrosPorSegundo } = ajustesDoPalco(qualidade);
  const intervaloEntreQuadros = 1000 / quadrosPorSegundo;
  const renderizador = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: soPersonagem });
  renderizador.setPixelRatio(resolucao);
  const cena = new THREE.Scene();
  if (!soPersonagem) {
    cena.background = new THREE.Color(cores.fundo);
    cena.fog = new THREE.Fog(cores.fundo, 9, 24);
  }
  const ambiente = new THREE.AmbientLight(CORES_DA_CENA.luz, 0.35);
  const frente = new THREE.DirectionalLight(CORES_DA_CENA.luzQuente, 0.6);
  frente.position.set(0, 3, 6);
  cena.add(ambiente, frente);
  const materialDoTelao = soPersonagem ? null : montarCenario(cena);
  const animarBanda = soPersonagem ? null : montarBanda(cena);
  const holofotes = HOLOFOTES.map(({ x, cor }) => criarHolofote(cena, x, cor));
  // Sobre o vídeo, os cones de luz ficam por conta dele; os holofotes só iluminam o personagem.
  if (soPersonagem) for (const { feixe } of holofotes) feixe.visible = false;
  // Sem o palco escuro em volta, o personagem precisa de mais luz para não sumir no vídeo.
  const luzDeBase = soPersonagem ? 0.7 : 0.25;
  const corDaEstrela = new THREE.Color(cores.estrela);
  const branco = new THREE.Color(cores.texto);

  const ator = criarAtor ? criarAtor(lerEstado()) : null;
  if (ator) cena.add(ator.raiz);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 60);

  // Reaproveitados a cada quadro, para não deixar lixo para o coletor no meio da música.
  const tamanho = new THREE.Vector2();
  const tom = new THREE.Color();
  const alvo = new THREE.Vector3();
  // O tamanho vem do ResizeObserver: ler clientWidth no loop força um layout por quadro.
  const medida = { largura: canvas.clientWidth, altura: canvas.clientHeight };
  const observador =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(([entrada]) => {
          medida.largura = entrada.contentRect.width;
          medida.altura = entrada.contentRect.height;
        });
  observador?.observe(canvas);

  let quadro = 0;
  let ultimoQuadro = 0;
  const desenhar = (agora: number) => {
    quadro = requestAnimationFrame(desenhar);
    if (agora - ultimoQuadro < intervaloEntreQuadros) return;
    const dt = Math.min(0.1, (agora - ultimoQuadro) / 1000);
    ultimoQuadro = agora;

    const estado = lerEstado();
    const largura = observador ? Math.round(medida.largura) : canvas.clientWidth;
    const altura = observador ? Math.round(medida.altura) : canvas.clientHeight;
    if (!largura || !altura) return;
    renderizador.getSize(tamanho);
    if (tamanho.x !== largura || tamanho.y !== altura) renderizador.setSize(largura, altura, false);

    ator?.atualizar(estado);
    ator?.animar(agora, dt);
    animarBanda?.(estado.tempo, estado.bpm);

    const plano = planoDaCamera(estado.tempo, estado.entrada, ator?.altura() ?? 1.6);
    camera.position.set(...plano.posicao);
    camera.lookAt(...plano.alvo);
    if (camera.aspect !== largura / altura) {
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
    }

    const luzes = luzesDoPalco({ tempo: estado.tempo, bpm: estado.bpm, desdeTrovao: estado.desdeTrovao, estrelaAtiva: estado.estrelaAtiva });
    holofotes.forEach((holofote, i) => {
      const cor = luzes.cor === "estrela" ? corDaEstrela : holofote.cor;
      tom.copy(cor).lerp(branco, luzes.clarao);
      holofote.luz.color.copy(tom);
      holofote.material.color.copy(tom);
      holofote.luz.intensity = (40 + 120 * luzes.clarao) * luzes.intensidade * luzes.foco;
      holofote.material.opacity = (0.05 + 0.12 * luzes.clarao) * luzes.intensidade * luzes.foco + 0.02;
      // Os holofotes varrem o palco, cada um no seu ritmo.
      alvo.set(Math.sin(estado.tempo * 0.7 + i * 1.7) * 1.8, 0, Math.cos(estado.tempo * 0.5 + i) * 0.8);
      holofote.luz.target.position.copy(alvo);
      holofote.feixe.lookAt(alvo);
    });
    ambiente.intensity = luzDeBase + 0.9 * luzes.clarao;
    // O telão acompanha o ritmo, mas tocando fica baixo para não disputar com as notas.
    materialDoTelao?.color.setScalar((0.15 + 0.5 * luzes.intensidade) * (luzes.foco < 1 ? 0.55 : 1) + luzes.clarao * 0.35);

    renderizador.render(cena, camera);
  };
  quadro = requestAnimationFrame(desenhar);

  return {
    descartar() {
      cancelAnimationFrame(quadro);
      observador?.disconnect();
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
