import { useEffect, useState } from "react";
import { Globe, RefreshCw, Users } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { Avatar, type Personagem } from "@/modules/rock/character";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import type { SalaOnline } from "../online";
import { MAXIMO_DE_JOGADORES } from "../protocolo";
import {
  criarSalaOnline,
  ehClienteWebDaSala,
  entrarNaSala,
  entrarNaSalaOnline,
  procurarSalasOnline,
  temModoOnline,
} from "../sala";

const INTERVALO_DA_BUSCA = 5000;

interface Props {
  personagem: Personagem;
  volumeDosEfeitos: number;
  aoEditarPersonagem: () => void;
}

export function ProcurarSala({
  personagem,
  volumeDosEfeitos,
  aoEditarPersonagem,
}: Props) {
  const [procurando, setProcurando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [publica, setPublica] = useState(true);
  const [salasOnline, setSalasOnline] = useState<SalaOnline[]>([]);
  const noCelular = ehClienteWebDaSala();
  // O celular que entrou pelo QR code só entra na sala de quem serviu a página.
  const online = temModoOnline() && !noCelular;

  const procurar = async () => {
    setProcurando(true);
    try {
      setSalasOnline(await procurarSalasOnline());
    } finally {
      setProcurando(false);
    }
  };

  useEffect(() => {
    if (!online) return;
    void procurar();
    const id = setInterval(() => void procurar(), INTERVALO_DA_BUSCA);
    return () => clearInterval(id);
    // A busca só depende de ter o modo online, que não muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:flex max-md:flex-col max-md:gap-2">
      {(noCelular || online) && (
        <section className="col-span-4 flex flex-col items-center gap-4 placa p-6 max-md:order-2 max-md:gap-2 max-md:p-3">
          <Avatar
            personagem={personagem}
            className="h-48 w-auto max-md:hidden"
          />
          <p className="text-xl font-black max-md:hidden">{personagem.nome}</p>
          <Button
            variant="outline"
            className="max-md:hidden"
            onClick={aoEditarPersonagem}
          >
            Editar personagem
          </Button>
          <div className="flex-1" />
          {noCelular && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                tocarEfeito("selecionar", volumeDosEfeitos);
                entrarNaSala(location.origin, personagem);
              }}
            >
              <Users className="opacity-70" /> Entrar na sala
            </Button>
          )}
          {online && (
            <>
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  tocarEfeito("selecionar", volumeDosEfeitos);
                  criarSalaOnline(personagem, publica);
                }}
              >
                <Globe className="opacity-70" /> Criar sala online
              </Button>
              {/* Desligado, a sala não aparece para quem procura: só entra quem tem o código. */}
              <div className="flex w-full items-center justify-between gap-2">
                <Label
                  htmlFor="sala-publica"
                  className="text-base text-texto-suave"
                >
                  Aparecer na lista
                </Label>
                <Switch
                  id="sala-publica"
                  checked={publica}
                  onCheckedChange={setPublica}
                />
              </div>
            </>
          )}
        </section>
      )}

      {!noCelular && !online && (
        <p className="col-span-12 flex items-center justify-center placa p-6 text-center text-base text-texto-suave max-md:order-1">
          O modo online não está disponível nesta versão do jogo.
        </p>
      )}

      {online && (
        <section className="col-span-8 flex min-h-0 flex-col gap-4 placa p-6 max-md:order-1 max-md:flex-none max-md:gap-2 max-md:p-3">
          <div className="flex items-center gap-4">
            <Globe className="text-primaria opacity-70" aria-hidden />
            <h2 className="text-xl font-bold max-md:text-base">
              Salas abertas
            </h2>
            <div className="flex-1" />
            <Button
              variant="ghost"
              onClick={() => void procurar()}
              disabled={procurando}
            >
              <RefreshCw
                className={
                  procurando ? "animate-spin opacity-70" : "opacity-70"
                }
              />{" "}
              Procurar
            </Button>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            {salasOnline.length === 0 && (
              <li className="py-12 text-center text-base text-texto-suave">
                {procurando
                  ? "Procurando salas..."
                  : "Nenhuma sala encontrada. Crie a sua ou peça para alguém criar."}
              </li>
            )}
            {salasOnline.map((s) => (
              <ItemDeSala
                key={s.codigo}
                nome={s.nome}
                detalhe={s.codigo}
                jogadores={s.jogadores}
                aoEntrar={() => {
                  tocarEfeito("selecionar", volumeDosEfeitos);
                  entrarNaSalaOnline(s.codigo, personagem);
                }}
              />
            ))}
          </ul>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              tocarEfeito("selecionar", volumeDosEfeitos);
              entrarNaSalaOnline(codigo, personagem);
            }}
          >
            <div className="flex-1">
              <Label
                htmlFor="codigo-da-sala"
                className="mb-2 text-base text-texto-suave"
              >
                Código da sala online
              </Label>
              <Input
                id="codigo-da-sala"
                placeholder="K7QXM"
                autoComplete="off"
                maxLength={7}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="font-mono text-base uppercase"
              />
            </div>
            <Button type="submit" variant="outline">
              Entrar online
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}

interface PropsDoItem {
  nome: string;
  detalhe: string;
  jogadores: number;
  aoEntrar: () => void;
}

/** Uma sala online aberta na lista. */
function ItemDeSala({ nome, detalhe, jogadores, aoEntrar }: PropsDoItem) {
  const cheia = jogadores >= MAXIMO_DE_JOGADORES;
  return (
    <li>
      <button
        onClick={aoEntrar}
        disabled={cheia}
        className="chapa flex w-full items-center gap-4 bg-superficie-elevada p-4 text-left max-md:gap-2 max-md:p-2 transition-colors hover:border-primaria disabled:opacity-50 disabled:hover:border-borda"
      >
        <Globe className="text-ouro opacity-70" aria-hidden />
        <span className="flex-1">
          <span className="block text-base font-bold">Sala de {nome}</span>
          <span className="block font-mono text-base text-texto-suave">
            {detalhe}
          </span>
        </span>
        <span className="rounded-full bg-superficie px-3 py-1 text-base">
          {cheia ? "Cheia" : `${jogadores}/${MAXIMO_DE_JOGADORES}`}
        </span>
      </button>
    </li>
  );
}
