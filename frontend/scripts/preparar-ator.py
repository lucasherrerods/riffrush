"""
Transforma o vídeo de uma pessoa de verdade num "ator digitalizado" 2D, estilo jogo de luta dos anos 90.
Uso: python scripts/preparar-ator.py atores/<id>.json

Para cada cena da receita: extrai os quadros do vídeo, recorta a pessoa do fundo (rembg),
enquadra todas as cenas do mesmo jeito (os pés sempre no mesmo lugar), reduz a resolução e as cores
e monta uma folha de sprites. Sai em public/modelos/atores/<id>/ com um manifesto.json.
Se existir <id>_card.png ao lado do vídeo, ele vira o card.webp da escolha de personagem.

Requer: ffmpeg no PATH e `pip install "rembg[cpu]" pillow numpy scipy`. Detalhes em docs/personagens.md.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage

CENAS = ["parado", "tocando", "errou", "vaiado", "nitro", "vitoria"]
PONTE = 4
MODELOS = ["u2net_human_seg", "isnet-general-use"]
MARGEM_DO_SEGUNDO_MODELO = 12
PADRAO = {"fps": 12, "altura": 256, "cores": 48, "alturaEmMetros": 1.75}


def ler_receita(caminho: Path):
    receita = {**PADRAO, **json.loads(caminho.read_text(encoding="utf-8"))}
    receita.setdefault("id", caminho.stem)
    faltando = [c for c in CENAS if c not in receita["cenas"]]
    if faltando:
        sys.exit(f"{caminho}: faltam as cenas {', '.join(faltando)} (cada uma é [inicio, fim] em segundos)")
    video = (caminho.parent / receita["video"]).resolve()
    if not video.exists():
        sys.exit(f"{caminho}: vídeo não encontrado em {video}")
    return receita, video


def extrair(video: Path, inicio: float, fim: float, fps: int, pasta: Path):
    pasta.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(inicio), "-to", str(fim), "-i", str(video), "-vf", f"fps={fps}", str(pasta / "%04d.png")],
        check=True,
    )
    return sorted(pasta.glob("*.png"))


def recortar(quadros, sessoes):
    """
    Tira o fundo e fica só com a maior mancha (a pessoa), sem cadeiras e gente passando atrás.
    Usa dois modelos, porque cada um erra em quadros diferentes.
    """
    recortados = []
    for arquivo in quadros:
        imagem = Image.open(arquivo).convert("RGB")
        rgba = np.array(imagem.convert("RGBA"))
        pessoa, geral = (np.array(remove(imagem, session=s, only_mask=True, post_process_mask=True)) > 128 for s in sessoes)
        # O modelo de pessoas pega o corpo inteiro, mas às vezes leva junto o que encosta nele;
        # o modelo geral erra o corpo de vez em quando, mas sabe onde ele está. Fica o primeiro, perto do segundo.
        alfa = pessoa & ndimage.binary_dilation(geral, iterations=MARGEM_DO_SEGUNDO_MODELO)
        # Abertura morfológica: corta "pontes" finas, como a cadeira encostada na mão.
        aberto = ndimage.binary_opening(alfa, structure=np.ones((3, 3)), iterations=PONTE)
        manchas, total = ndimage.label(aberto)
        if total:
            tamanhos = ndimage.sum(aberto, manchas, range(1, total + 1))
            corpo = manchas == (1 + int(np.argmax(tamanhos)))
            # Devolve os detalhes finos (dedos, cabelo) que encostam no corpo, mas não o que estava solto.
            alfa = alfa & ndimage.binary_dilation(corpo, structure=np.ones((3, 3)), iterations=PONTE + 1)
        # Borda dura, sem semitransparência: é o contorno serrilhado dos sprites digitalizados.
        rgba[..., 3] = np.where(alfa, 255, 0)
        recortados.append(rgba)
    return recortados


def caixa_comum(todos):
    """Um enquadramento só para todas as cenas, para o personagem não pular ao trocar de cena."""
    x0 = y0 = 10**9
    x1 = y1 = 0
    for rgba in todos:
        ys, xs = np.nonzero(rgba[..., 3])
        if len(xs):
            x0, x1 = min(x0, xs.min()), max(x1, xs.max())
            y0, y1 = min(y0, ys.min()), max(y1, ys.max())
    margem = 4
    return max(0, x0 - margem), max(0, y0 - margem), x1 + margem, y1 + 1


def estilizar(rgba, caixa, altura, cores):
    """Recorta, reduz e posteriza: poucas cores e pixels grandes, como vídeo digitalizado em 1993."""
    imagem = Image.fromarray(rgba).crop(caixa)
    largura = round(imagem.width * altura / imagem.height)
    imagem = imagem.resize((largura, altura), Image.Resampling.BILINEAR)
    alfa = imagem.getchannel("A").point(lambda a: 255 if a > 127 else 0)
    cor = imagem.convert("RGB").quantize(colors=cores, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    cor.putalpha(alfa)
    return cor


def folha(quadros):
    """Junta os quadros numa grade quase quadrada."""
    colunas = int(np.ceil(np.sqrt(len(quadros))))
    linhas = int(np.ceil(len(quadros) / colunas))
    largura, altura = quadros[0].size
    imagem = Image.new("RGBA", (colunas * largura, linhas * altura), (0, 0, 0, 0))
    for i, quadro in enumerate(quadros):
        imagem.paste(quadro, ((i % colunas) * largura, (i // colunas) * altura))
    return imagem, colunas, linhas


LARGURA_MAXIMA_DO_CARD = 1024


def preparar_card(pasta_do_video: Path, ator: str, destino: Path):
    """Converte a arte vertical do ator em webp, sem passar da largura máxima. Devolve o nome do arquivo ou None."""
    origem = pasta_do_video / f"{ator}_card.png"
    if not origem.exists():
        return None
    imagem = Image.open(origem).convert("RGB")
    if imagem.width > LARGURA_MAXIMA_DO_CARD:
        altura = round(imagem.height * LARGURA_MAXIMA_DO_CARD / imagem.width)
        imagem = imagem.resize((LARGURA_MAXIMA_DO_CARD, altura), Image.Resampling.LANCZOS)
    imagem.save(destino / "card.webp", quality=82)
    return "card.webp"


def main():
    if len(sys.argv) < 2:
        sys.exit("Uso: python scripts/preparar-ator.py atores/<id>.json")
    receita, video = ler_receita(Path(sys.argv[1]))
    destino = Path("public/modelos/atores") / receita["id"]
    destino.mkdir(parents=True, exist_ok=True)
    sessoes = [new_session(modelo) for modelo in MODELOS]

    recortes = {}
    with tempfile.TemporaryDirectory() as temp:
        for cena in CENAS:
            inicio, fim = receita["cenas"][cena]
            quadros = extrair(video, inicio, fim, receita["fps"], Path(temp) / cena)
            recortes[cena] = recortar(quadros, sessoes)
            print(f"{cena}: {len(quadros)} quadros")

    caixa = caixa_comum([q for lista in recortes.values() for q in lista])
    # A altura da receita é a da pessoa parada; o quadro é mais alto (sobra espaço para os braços levantados).
    ys = np.nonzero(recortes["parado"][0][caixa[1] : caixa[3], caixa[0] : caixa[2], 3])[0]
    ocupa = (ys.max() - ys.min() + 1) / (caixa[3] - caixa[1])
    manifesto = {"nome": receita["nome"], "fps": receita["fps"], "alturaEmMetros": round(receita["alturaEmMetros"] / ocupa, 3), "cenas": {}}
    for cena, lista in recortes.items():
        quadros = [estilizar(q, caixa, receita["altura"], receita["cores"]) for q in lista]
        imagem, colunas, linhas = folha(quadros)
        imagem.save(destino / f"{cena}.png", optimize=True)
        manifesto["cenas"][cena] = {
            "arquivo": f"{cena}.png",
            "quadros": len(quadros),
            "colunas": colunas,
            "linhas": linhas,
            "largura": quadros[0].width,
            "altura": quadros[0].height,
        }
    card = preparar_card(video.parent, receita["id"], destino)
    if card:
        manifesto["card"] = card
        print(f"card: {card}")
    (destino / "manifesto.json").write_text(json.dumps(manifesto, indent=2, ensure_ascii=False), encoding="utf-8")
    total = sum(f.stat().st_size for f in destino.iterdir()) / 1024
    print(f"{destino}: {total:.0f} KB")


if __name__ == "__main__":
    main()
