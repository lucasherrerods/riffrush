import { useEffect, useState } from "react";
import { Crown, Globe, Plus, RefreshCw, Users, Wifi } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import { Avatar, type Personagem } from "@/modules/character";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import { MAXIMO_DE_JOGADORES } from "../protocolo";
import { PORTA_DA_SALA, criarSala, criarSalaOnline, ehClienteWebDaSala, entrarNaSala, entrarNaSalaOnline, procurarSalas, temModoOnline, type SalaEncontrada } from "../sala";

const INTERVALO_DA_BUSCA = 5000;

interface Props {
  personagem: Personagem;
  volumeDosEfeitos: number;
  aoEditarPersonagem: () => void;
}

export function ProcurarSala({ personagem, volumeDosEfeitos, aoEditarPersonagem }: Props) {
  const [salas, setSalas] = useState<SalaEncontrada[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [ip, setIp] = useState("");
  const [codigo, setCodigo] = useState("");
  const noCelular = ehClienteWebDaSala();
  // O celular que entrou pelo QR code só entra na sala de quem serviu a página.
  const online = temModoOnline() && !noCelular;

  const procurar = async () => {
    setProcurando(true);
    try {
      setSalas(await procurarSalas());
    } catch {
      setSalas([]);
    } finally {
      setProcurando(false);
    }
  };

  useEffect(() => {
    if (noCelular) return;
    void procurar();
    const id = setInterval(() => void procurar(), INTERVALO_DA_BUSCA);
    return () => clearInterval(id);
    // A busca só depende de estar ou não no celular, que não muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = (endereco: string) => {
    tocarEfeito("selecionar", volumeDosEfeitos);
    entrarNaSala(endereco, personagem);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1">
      <section className="col-span-4 flex flex-col items-center gap-4 placa p-6">
        <Avatar personagem={personagem} className="h-48 w-auto" />
        <p className="text-xl font-black">{personagem.nome}</p>
        <Button variant="outline" onClick={aoEditarPersonagem}>
          Editar personagem
        </Button>
        <div className="flex-1" />
        {noCelular ? (
          <Button size="lg" className="w-full" onClick={() => entrar(location.origin)}>
            <Users className="opacity-70" /> Entrar na sala
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              tocarEfeito("selecionar", volumeDosEfeitos);
              void criarSala(personagem);
            }}
          >
            <Plus className="opacity-70" /> Criar sala na rede
          </Button>
        )}
        {online && (
          <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                tocarEfeito("selecionar", volumeDosEfeitos);
                criarSalaOnline(personagem);
              }}
            >
              <Globe className="opacity-70" /> Criar sala online
            </Button>
        )}
      </section>

      {!noCelular && (
        <section className="col-span-8 flex min-h-0 flex-col gap-4 placa p-6">
          <div className="flex items-center gap-4">
            <Wifi className="text-primaria opacity-70" aria-hidden />
            <h2 className="text-xl font-bold">Salas na sua rede</h2>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => void procurar()} disabled={procurando}>
              <RefreshCw className={procurando ? "animate-spin opacity-70" : "opacity-70"} /> Procurar
            </Button>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            {salas.length === 0 && (
              <li className="py-12 text-center text-base text-texto-suave">
                {procurando ? "Procurando salas..." : "Nenhuma sala encontrada. Crie a sua ou peça para alguém criar."}
              </li>
            )}
            {salas.map((s) => (
              <li key={`${s.ip}:${s.porta}`}>
                <button
                  onClick={() => entrar(`http://${s.ip}:${s.porta}`)}
                  className="chapa flex w-full items-center gap-4 bg-superficie-elevada p-4 text-left transition-colors hover:border-primaria"
                >
                  <Crown className="text-ouro opacity-70" aria-hidden />
                  <span className="flex-1">
                    <span className="block text-base font-bold">Sala de {s.nome}</span>
                    <span className="block font-mono text-base text-texto-suave">{s.ip}</span>
                  </span>
                  <span className="rounded-full bg-superficie px-3 py-1 text-base">
                    {s.jogadores}/{MAXIMO_DE_JOGADORES}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {online && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  tocarEfeito("selecionar", volumeDosEfeitos);
                  entrarNaSalaOnline(codigo, personagem);
                }}
              >
                <div className="flex-1">
                  <Label htmlFor="codigo-da-sala" className="mb-2 text-base text-texto-suave">
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
            )}
            <form
              className={cn("flex items-end gap-2", !online && "col-span-2")}
              onSubmit={(e) => {
                e.preventDefault();
                const limpo = ip.trim().replace(/^https?:\/\//, "").replace(/:\d+$/, "");
                if (limpo) entrar(`http://${limpo}:${PORTA_DA_SALA}`);
              }}
            >
              <div className="flex-1">
                <Label htmlFor="ip-do-host" className="mb-2 text-base text-texto-suave">
                  Ou digite o IP do host
                </Label>
                <Input id="ip-do-host" placeholder="192.168.0.10" value={ip} onChange={(e) => setIp(e.target.value)} className="text-base" />
              </div>
              <Button type="submit" variant="outline">
                Entrar
              </Button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
