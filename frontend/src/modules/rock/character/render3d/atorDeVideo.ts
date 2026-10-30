import * as THREE from "three";
import { skinDoPersonagem } from "../catalogo";
import { migrarPersonagem } from "../personagem";
import { novaReacao, type TipoDeReacao } from "../reacao";
import { cenaDoAtor, dadosDaCena, quadroDaCena, recorteDoQuadro, type ManifestoDoAtor, type NomeDaCena } from "../video";
import type { Ator, EstadoDoAvatar } from "./ator";

const manifestos = new Map<string, Promise<ManifestoDoAtor>>();

function carregarManifesto(pasta: string) {
  let pedido = manifestos.get(pasta);
  if (!pedido) {
    pedido = fetch(`${pasta}/manifesto.json`).then((resposta) => {
      if (!resposta.ok) throw new Error(`Não foi possível carregar ${pasta}`);
      return resposta.json() as Promise<ManifestoDoAtor>;
    });
    pedido.catch(() => manifestos.delete(pasta));
    manifestos.set(pasta, pedido);
  }
  return pedido;
}

/** Pixels grandes e sem suavização: o visual de vídeo digitalizado dos anos 90. */
function texturaDaFolha(url: string) {
  const textura = new THREE.TextureLoader().load(url);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.NearestFilter;
  textura.minFilter = THREE.NearestFilter;
  textura.generateMipmaps = false;
  return textura;
}

/**
 * Ator filmado: um "recorte de papelão" no palco com as folhas de sprites da pessoa.
 * Segue a mesma interface do ator VRM, então palco, HUD e reações funcionam igual.
 */
export function criarAtorDeVideo(estadoInicial: EstadoDoAvatar): Ator {
  const raiz = new THREE.Group();
  let estado = estadoInicial;
  let reacao: { tipo: TipoDeReacao; contador: number; inicio: number } | null = null;
  const comecarReacao = (tipo: TipoDeReacao, contador: number) => (reacao = { tipo, contador, inicio: performance.now() });
  if (estado.reacao) comecarReacao(estado.reacao.tipo, estado.reacao.contador);

  let manifesto: ManifestoDoAtor | null = null;
  const texturas = new Map<NomeDaCena, THREE.Texture>();
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plano.visible = false;
  raiz.add(plano);
  let cenaAtual: NomeDaCena | null = null;
  let inicioDaCena = 0;
  let contadorDaCena = -1;
  let removido = false;

  const personagem = migrarPersonagem(estadoInicial.personagem);
  const pasta = skinDoPersonagem(personagem).arquivo;
  void carregarManifesto(pasta)
    .then((carregado) => {
      if (removido) return;
      manifesto = carregado;
      for (const [nome, cena] of Object.entries(carregado.cenas)) if (cena) texturas.set(nome as NomeDaCena, texturaDaFolha(`${pasta}/${cena.arquivo}`));
    })
    .catch((erro) => console.error("[ator filmado]", erro));

  return {
    raiz,
    altura: () => manifesto?.alturaEmMetros ?? null,
    atualizar(novo) {
      if (novo.reacao && (novo.reacao.contador !== reacao?.contador || novo.reacao.tipo !== reacao?.tipo)) comecarReacao(novo.reacao.tipo, novo.reacao.contador);
      else if (!novo.reacao && reacao && estado.reacao) reacao = null;
      estado = novo;
    },
    reagir(tipo) {
      const nova = novaReacao(reacao, tipo);
      comecarReacao(nova.tipo, nova.contador);
    },
    animar(agora) {
      if (!manifesto) return;
      const desdeReacao = reacao ? (agora - reacao.inicio) / 1000 : 0;
      const { cena: pedida, repetir } = cenaDoAtor({ tocando: estado.tocando, triste: estado.triste, reacao: reacao?.tipo ?? null, desdeReacao });
      const { nome: cena, dados } = dadosDaCena(manifesto.cenas, pedida);
      // Trocou de cena, ou a mesma reação veio de novo (outro erro): recomeça do primeiro quadro.
      const contador = reacao && !repetir ? reacao.contador : -1;
      if (cena !== cenaAtual || contador !== contadorDaCena) {
        cenaAtual = cena;
        contadorDaCena = contador;
        inicioDaCena = reacao && !repetir ? reacao.inicio : agora;
        material.map = texturas.get(cena) ?? null;
        material.needsUpdate = true;
        const altura = manifesto.alturaEmMetros;
        plano.scale.set((altura * dados.largura) / dados.altura, altura, 1);
        // Os pés ficam no chão (o plano nasce centrado).
        plano.position.y = altura / 2;
        plano.visible = true;
      }
      const mapa = material.map;
      if (!mapa) return;
      const recorte = recorteDoQuadro(dados, quadroDaCena(dados, (agora - inicioDaCena) / 1000, manifesto.fps, repetir));
      mapa.repeat.set(recorte.largura, recorte.altura);
      mapa.offset.set(recorte.x, recorte.y);
    },
    descartar() {
      removido = true;
      for (const textura of texturas.values()) textura.dispose();
      material.dispose();
      plano.geometry.dispose();
      raiz.removeFromParent();
    },
  };
}
