import { useState, type ReactNode } from "react";
import { Play, Radio, Search, Settings2, Shirt, Trophy, Users } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import type { Documento } from "@/modules/legal";
import { abrirLink } from "@/modules/platform";
import { cn } from "@/shared/lib/utils";
import { IconeGithub } from "@/shared/ui/IconeGithub";
import { EscolhaDoMultiplayer } from "./EscolhaDoMultiplayer";
import { LogoDoJogo } from "./LogoDoJogo";
import { TelaInicial, type OpcaoDaTelaInicial, type TrocaDeModo } from "./TelaInicial";

interface Props {
  volumeDosEfeitos: number;
  /** Celular que entrou pelo QR code: o foco é a sala. */
  noCelular?: boolean;
  aoJogar: () => void;
  /** As salas online. */
  aoMultijogador: () => void;
  /** Só no computador: vários jogadores na mesma tela. Com ele, o Multiplayer pergunta antes se é local ou online. */
  aoMultiplayerLocal?: () => void;
  aoPersonagem: () => void;
  /** Só sem conta: com ela, as configurações ficam no menu da conta. */
  aoConfigurar?: () => void;
  aoBuscarMusicas: () => void;
  /** Sem contas ligadas não há leaderboard, e a opção some. */
  aoLeaderboard?: () => void;
  /** Sem o relay ou sem contas não há quem está online, e a opção some. */
  aoOnline?: () => void;
  aoAbrirDocumento: (documento: Documento) => void;
  /** O chat global, no canto de baixo à esquerda. */
  chat?: ReactNode;
  /** A alavanca que troca para o Mania, embaixo da logo. */
  alavanca?: ReactNode;
  troca?: TrocaDeModo;
  aoMedirTitulo?: (retangulo: DOMRect) => void;
}

type Item = OpcaoDaTelaInicial;

const URL_DO_PROJETO = "https://github.com/lucasherrerods/riffrush";
const URL_DA_LANDING = "https://playriffrush.vercel.app";

export function MenuPrincipal({ volumeDosEfeitos, noCelular = false, aoJogar, aoMultijogador, aoMultiplayerLocal, aoPersonagem, aoConfigurar, aoBuscarMusicas, aoLeaderboard, aoOnline, aoAbrirDocumento, chat, alavanca, troca, aoMedirTitulo }: Props) {
  const [escolhendoMultiplayer, setEscolhendoMultiplayer] = useState(false);
  const buscar: Item = { rotulo: "Buscar músicas", icone: Search, acao: aoBuscarMusicas };
  const comuns: Item[] = [
    ...(aoLeaderboard ? [{ rotulo: "Leaderboard", icone: Trophy, acao: aoLeaderboard }] : []),
    ...(aoOnline ? [{ rotulo: "Online", icone: Radio, acao: aoOnline }] : []),
    { rotulo: "Personagem", icone: Shirt, acao: aoPersonagem },
    ...(aoConfigurar ? [{ rotulo: "Configurações", icone: Settings2, acao: aoConfigurar }] : []),
  ];
  const itens: Item[] = noCelular
    ? [{ rotulo: "Entrar na sala", icone: Users, acao: aoMultijogador }, { rotulo: "Jogar sozinho", icone: Play, acao: aoJogar }, buscar, ...comuns]
    : [
        { rotulo: "Jogar", icone: Play, acao: aoJogar },
        { rotulo: "Multiplayer", icone: Users, acao: aoMultiplayerLocal ? () => setEscolhendoMultiplayer(true) : aoMultijogador },
        buscar,
        ...comuns,
      ];

  return (
    <TelaInicial
      logo={<LogoDoJogo modo="Rock" />}
      subtitulo="O PALCO É SEU"
      alavanca={alavanca}
      troca={troca}
      aoMedirTitulo={aoMedirTitulo}
      opcoes={itens}
      pausada={escolhendoMultiplayer}
      aoMover={() => tocarEfeito("mover", volumeDosEfeitos)}
      aoEscolher={() => tocarEfeito("selecionar", volumeDosEfeitos)}
      className={cn(chat && "max-md:pb-16")}
    >
      {aoMultiplayerLocal && (
        <EscolhaDoMultiplayer
          aberta={escolhendoMultiplayer}
          aoFechar={() => setEscolhendoMultiplayer(false)}
          aoLocal={() => {
            tocarEfeito("selecionar", volumeDosEfeitos);
            setEscolhendoMultiplayer(false);
            aoMultiplayerLocal();
          }}
          aoOnline={() => {
            tocarEfeito("selecionar", volumeDosEfeitos);
            setEscolhendoMultiplayer(false);
            aoMultijogador();
          }}
        />
      )}

      {chat && (
        <aside aria-label="Chat" className="absolute bottom-4 left-4 flex max-h-72 w-96 origin-bottom-left scale-[0.8] flex-col justify-end max-lg:hidden max-md:fixed max-md:bottom-0 max-md:left-[1%] max-md:z-10 max-md:flex max-md:w-[98%] max-md:scale-100">
          {chat}
        </aside>
      )}

      <footer className="flex flex-wrap items-center justify-center gap-3 text-xs [&_svg]:size-4 text-texto-suave md:absolute md:right-4 md:bottom-4">
        {(
          [
            ["privacidade", "Política de Privacidade"],
            ["termos", "Termos de Uso"],
          ] as const
        ).map(([documento, rotulo]) => (
          <a
            key={documento}
            href={`/${documento}`}
            onClick={(evento) => {
              evento.preventDefault();
              aoAbrirDocumento(documento);
            }}
            className="opacity-70 transition-opacity hover:opacity-100"
          >
            {rotulo}
          </a>
        ))}
        <LinkExterno url={URL_DA_LANDING}>Sobre</LinkExterno>
        <span>© 2026 Riff Rush</span>
        <LinkExterno url={URL_DO_PROJETO} rotulo="Riff Rush no GitHub">
          <IconeGithub />
        </LinkExterno>
      </footer>
    </TelaInicial>
  );
}

/** Link para fora do jogo: no app desktop abre no navegador do sistema, e não dentro da janela. */
function LinkExterno({ url, rotulo, children }: { url: string; rotulo?: string; children: ReactNode }) {
  return (
    <a
      href={url}
      aria-label={rotulo}
      onClick={(evento) => {
        evento.preventDefault();
        void abrirLink(url);
      }}
      className="opacity-70 transition-opacity hover:opacity-100"
    >
      {children}
    </a>
  );
}
