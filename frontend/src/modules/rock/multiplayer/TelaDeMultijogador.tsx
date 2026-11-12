import { ProcurarSala, TelaDaSala } from "@/modules/multiplayer";
import { Avatar, type Personagem } from "@/modules/rock/character";
import type { Dificuldade, Instrumento, Musica } from "@/modules/rock/songs";
import { Button } from "@/shared/ui/button";
import { Lobby } from "./componentes/Lobby";
import { podeTocarOnline } from "./musicaNaRede";
import { criarSalaOnline, ehClienteWebDaSala, entrarNaSala, entrarNaSalaOnline, procurarSalasOnline, sairDaSala, temModoOnline, useConexao } from "./sala";

interface Props {
  personagem: Personagem;
  musicas: Musica[];
  volumeDosEfeitos: number;
  aoVoltar: () => void;
  aoEditarPersonagem: () => void;
  /** Abre a busca de músicas sem sair da sala. */
  aoBuscarMusicas: () => void;
  /** Sorteia e baixa um chart oficial para a sala. */
  sortearAleatoria?: (dificuldade: Dificuldade, instrumento: Instrumento) => Promise<Musica>;
  /** Abre a lista de amigos para chamar alguém. Só a sala online alcança os amigos. */
  aoConvidarAmigos?: () => void;
}

export function TelaDeMultijogador({ personagem, musicas, volumeDosEfeitos, aoVoltar, aoEditarPersonagem, aoBuscarMusicas, sortearAleatoria, aoConvidarAmigos }: Props) {
  const { sala, info, erro, online, codigo, endereco } = useConexao();
  const musicasDaSala = online ? musicas.filter(podeTocarOnline) : musicas;

  return (
    <TelaDaSala
      naSala={!!sala}
      conectando={sala?.status === "conectando"}
      erro={erro}
      aoVoltar={aoVoltar}
      aoSair={() => sairDaSala()}
      aoBaixar={aoBuscarMusicas}
      aoConvidarAmigos={online ? aoConvidarAmigos : undefined}
      busca={
        <ProcurarSala
          volumeDosEfeitos={volumeDosEfeitos}
          retrato={
            <>
              <Avatar personagem={personagem} className="h-48 w-auto max-md:hidden" />
              <p className="text-xl font-black max-md:hidden">{personagem.nome}</p>
              <Button variant="outline" className="max-md:hidden" onClick={aoEditarPersonagem}>
                Editar personagem
              </Button>
            </>
          }
          acoes={{
            ehClienteWebDaSala: () => ehClienteWebDaSala(),
            temModoOnline: () => temModoOnline(),
            procurarSalasOnline: () => procurarSalasOnline(),
            criarSalaOnline: (publica) => criarSalaOnline(personagem, publica),
            entrarNaSalaOnline: (texto) => entrarNaSalaOnline(texto, personagem),
            entrarNaSalaDoCelular: () => entrarNaSala(location.origin, personagem),
          }}
        />
      }
      lobby={sala && <Lobby sala={sala} info={info} codigo={codigo} endereco={endereco} musicas={musicasDaSala} volumeDosEfeitos={volumeDosEfeitos} sortearAleatoria={sortearAleatoria} />}
    />
  );
}
