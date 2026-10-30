import { ArrowLeft, Eye, Loader2, Radio, UserRound } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import type { EstadoDaPresenca } from "./conexao";
import { descreverEstado } from "./descrever";
import { ordenarPessoas, type PessoaOnline } from "./protocolo";

export interface PreferenciasOnline {
  /** `null` enquanto a pessoa ainda não respondeu se quer aparecer. */
  mostrarOnline: boolean | null;
  permitirEspectadores: boolean;
}

interface Props extends PreferenciasOnline {
  logado: boolean;
  euId: string | null;
  presenca: EstadoDaPresenca;
  aoMudar: (preferencias: Partial<PreferenciasOnline>) => void;
  aoAssistir: (pessoa: PessoaOnline) => void;
  aoVoltar: () => void;
}

/** Quem está online agora e, para quem deixa, o botão de assistir à partida ao vivo. */
export function TelaOnline({ logado, euId, presenca, mostrarOnline, permitirEspectadores, aoMudar, aoAssistir, aoVoltar }: Props) {
  useTeclado((evento) => evento.code === "Escape" && aoVoltar());

  return (
    <div className="respiro-de-tela flex h-full flex-col">
      <header className="flex items-center gap-4 max-md:gap-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela">Online</h1>
      </header>

      <section className="placa mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 p-4">
        {!logado ? (
          <p className="m-auto text-base text-texto-suave">Entre na sua conta para ver quem está online.</p>
        ) : mostrarOnline !== true ? (
          <Consentimento recusou={mostrarOnline === false} aoAceitar={() => aoMudar({ mostrarOnline: true })} aoRecusar={() => aoMudar({ mostrarOnline: false })} />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <Opcao id="mostrar-online" rotulo="Aparecer online" ligada onMudar={(ligada) => aoMudar({ mostrarOnline: ligada })} />
              <Opcao id="espectadores" rotulo="Deixar assistirem minhas partidas" ligada={permitirEspectadores} onMudar={(ligada) => aoMudar({ permitirEspectadores: ligada })} />
            </div>
            <Lista presenca={presenca} euId={euId} aoAssistir={aoAssistir} />
          </>
        )}
      </section>
    </div>
  );
}

function Consentimento({ recusou, aoAceitar, aoRecusar }: { recusou: boolean; aoAceitar: () => void; aoRecusar: () => void }) {
  return (
    <div className="m-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <Radio className="size-8 text-texto-suave opacity-70" aria-hidden />
      <p className="text-base">
        Para ver quem está online, você também aparece na lista: seu nome, sua foto e a música que está tocando. Quem estiver online pode assistir às suas
        partidas ao vivo. Dá para desligar as duas coisas quando quiser.
      </p>
      {recusou && <p className="text-base text-texto-suave">Você escolheu não aparecer online.</p>}
      <div className="flex gap-4">
        <Button size="lg" onClick={aoAceitar}>
          Aparecer online
        </Button>
        {!recusou && (
          <Button size="lg" variant="outline" onClick={aoRecusar}>
            Agora não
          </Button>
        )}
      </div>
    </div>
  );
}

function Opcao({ id, rotulo, ligada, onMudar }: { id: string; rotulo: string; ligada: boolean; onMudar: (ligada: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={ligada} onCheckedChange={onMudar} />
      <Label htmlFor={id} className="text-base">
        {rotulo}
      </Label>
    </div>
  );
}

function Lista({ presenca, euId, aoAssistir }: { presenca: EstadoDaPresenca; euId: string | null; aoAssistir: (pessoa: PessoaOnline) => void }) {
  if (!presenca.conectada) {
    return (
      <p className="m-auto flex items-center gap-2 text-base text-texto-suave">
        <Loader2 className="size-4 animate-spin opacity-70" aria-hidden /> Conectando...
      </p>
    );
  }
  const pessoas = ordenarPessoas(presenca.pessoas, euId);
  if (!pessoas.length) return <p className="m-auto text-base text-texto-suave">Só você está online agora.</p>;
  return (
    <ul aria-label="Pessoas online" className="sem-barra-de-rolagem flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {pessoas.map((pessoa) => (
        <li key={pessoa.id} className="chapa flex items-center gap-4 border-borda bg-superficie px-4 py-2">
          {pessoa.avatar ? (
            <img src={pessoa.avatar} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-sm" />
          ) : (
            <UserRound className="size-8 shrink-0 text-texto-suave opacity-70" aria-hidden />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-bold">{pessoa.nome}</span>
            <span className="truncate text-base text-texto-suave">{descreverEstado(pessoa.estado)}</span>
          </span>
          {pessoa.estado.tipo === "tocando" && pessoa.estado.transmitindo && (
            <Button variant="outline" onClick={() => aoAssistir(pessoa)} aria-label={`Assistir ${pessoa.nome}`}>
              <Eye className="opacity-70" /> Assistir
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
