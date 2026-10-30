import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { FotoDaConta } from "@/modules/conta";
import { presenca, type ConviteParaSala } from "@/modules/presenca";
import { Button } from "@/shared/ui/button";
import { avisar } from "@/shared/ui/avisos";
import { pedidosNovos } from "./amigos";
import type { PessoaDaAmizade } from "./api";
import { listaDeAmigos } from "./loja";

/** Quanto tempo o convite fica na tela antes de sumir sozinho. */
export const DURACAO_DO_CONVITE_MS = 20_000;
/** Mais que isso, os mais antigos saem para não cobrir a tela. */
const CONVITES_NA_TELA = 3;

type Aviso = { tipo: "sala"; convite: ConviteParaSala } | { tipo: "amizade"; pessoa: PessoaDaAmizade };

const idDoAviso = (aviso: Aviso) => (aviso.tipo === "sala" ? `sala-${aviso.convite.de.id}-${aviso.convite.codigo}` : `amizade-${aviso.pessoa.conta_id}`);
const autorDoAviso = (aviso: Aviso) => (aviso.tipo === "sala" ? aviso.convite.de.id : aviso.pessoa.conta_id);

/**
 * Convites de amigos para a sala e pedidos de amizade novos, num cartão no canto da tela, com a resposta ali mesmo.
 * O relay entrega convite de sala de qualquer conta: o de quem não é amigo nem aparece.
 */
export function ConvitesDeAmigos({ aoEntrar, duracaoMs = DURACAO_DO_CONVITE_MS }: { aoEntrar: (codigo: string) => void; duracaoMs?: number }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const dispensar = (aviso: Aviso) => setAvisos((atuais) => atuais.filter((a) => a !== aviso));
  const mostrar = (aviso: Aviso) => {
    // A mesma pessoa de novo troca o aviso antigo pelo novo.
    setAvisos((atuais) => [...atuais.filter((a) => !(a.tipo === aviso.tipo && autorDoAviso(a) === autorDoAviso(aviso))), aviso].slice(-CONVITES_NA_TELA));
    setTimeout(() => dispensar(aviso), duracaoMs);
  };

  useEffect(
    () =>
      presenca.ouvirConvites((convite) => {
        const amigos = listaDeAmigos.estado().listas?.amigos ?? [];
        if (amigos.some((a) => a.conta_id === convite.de.id)) mostrar({ tipo: "sala", convite });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duracaoMs],
  );

  // A lista é buscada de novo de tempos em tempos: o que entrou desde a busca anterior vira aviso.
  const recebidosAntes = useRef<PessoaDaAmizade[] | null>(listaDeAmigos.estado().listas?.recebidos ?? null);
  useEffect(
    () =>
      listaDeAmigos.inscrever(() => {
        const recebidos = listaDeAmigos.estado().listas?.recebidos ?? null;
        if (recebidos) for (const pessoa of pedidosNovos(recebidosAntes.current, recebidos)) mostrar({ tipo: "amizade", pessoa });
        recebidosAntes.current = recebidos;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duracaoMs],
  );

  const responderPedido = (aviso: Aviso & { tipo: "amizade" }, aceitar: boolean) => {
    dispensar(aviso);
    const { conta_id, nome } = aviso.pessoa;
    void listaDeAmigos
      .agir((api, token) => (aceitar ? api.aceitar(token, conta_id) : api.desfazer(token, conta_id)))
      .then(() => aceitar && avisar.success(`Você e ${nome} agora são amigos.`))
      .catch((erro: Error) => avisar.error(erro.message));
  };

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2 max-md:inset-x-2 max-md:top-2 max-md:bottom-auto max-md:w-auto">
      <AnimatePresence>
        {avisos.map((aviso) =>
          aviso.tipo === "sala" ? (
            <Cartao
              key={idDoAviso(aviso)}
              avatar={aviso.convite.de.avatar}
              rotuloDoFechar="Fechar convite"
              aoFechar={() => dispensar(aviso)}
              texto={
                <>
                  <span className="font-bold">{aviso.convite.de.nome}</span> chamou você para a sala <span className="font-titulo text-lg">{aviso.convite.codigo}</span>
                </>
              }
            >
              <Button variant="ghost" size="sm" onClick={() => dispensar(aviso)}>
                Recusar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  dispensar(aviso);
                  aoEntrar(aviso.convite.codigo);
                }}
              >
                Aceitar
              </Button>
            </Cartao>
          ) : (
            <Cartao
              key={idDoAviso(aviso)}
              avatar={aviso.pessoa.avatar}
              rotuloDoFechar="Fechar pedido"
              aoFechar={() => dispensar(aviso)}
              texto={
                <>
                  <span className="font-bold">{aviso.pessoa.nome}</span> quer ser seu amigo
                </>
              }
            >
              <Button variant="ghost" size="sm" onClick={() => responderPedido(aviso, false)}>
                Recusar
              </Button>
              <Button size="sm" onClick={() => responderPedido(aviso, true)}>
                Aceitar
              </Button>
            </Cartao>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

function Cartao({ avatar, texto, rotuloDoFechar, aoFechar, children }: { avatar: string | null; texto: ReactNode; rotuloDoFechar: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.15 }}
      className="chapa pointer-events-auto flex flex-col gap-2 border-borda bg-superficie-elevada p-4"
    >
      <div className="flex items-start gap-2">
        <FotoDaConta avatar={avatar} className="size-10" />
        <p className="min-w-0 flex-1 text-base">{texto}</p>
        <Button variant="ghost" size="icon-sm" aria-label={rotuloDoFechar} onClick={aoFechar}>
          <X />
        </Button>
      </div>
      <div className="flex justify-end gap-2">{children}</div>
    </motion.div>
  );
}
