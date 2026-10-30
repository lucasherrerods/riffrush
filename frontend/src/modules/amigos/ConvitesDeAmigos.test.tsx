import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConviteParaSala } from "@/modules/presenca";
import { ConvitesDeAmigos } from "./ConvitesDeAmigos";

const ouvir = vi.hoisted(() => ({ ouvinte: null as ((c: ConviteParaSala) => void) | null }));

vi.mock("@/modules/presenca", async (original) => ({
  ...(await original<typeof import("@/modules/presenca")>()),
  presenca: {
    ouvirConvites: (fn: (c: ConviteParaSala) => void) => {
      ouvir.ouvinte = fn;
      return () => (ouvir.ouvinte = null);
    },
  },
}));
const lista = vi.hoisted(() => {
  const ouvintes = new Set<() => void>();
  const api = { aceitar: vi.fn(async () => undefined), desfazer: vi.fn(async () => undefined) };
  const estado = { listas: { amigos: [{ conta_id: "amiga" }], recebidos: [] as { conta_id: string; nome: string; avatar: null }[] } };
  return {
    api,
    estado,
    /** Como se a busca periódica trouxesse estes pedidos. */
    receber(recebidos: typeof estado.listas.recebidos) {
      estado.listas = { ...estado.listas, recebidos };
      for (const ouvinte of ouvintes) ouvinte();
    },
    listaDeAmigos: {
      estado: () => estado,
      inscrever: (ouvinte: () => void) => (ouvintes.add(ouvinte), () => ouvintes.delete(ouvinte)),
      agir: (acao: (a: typeof api, token: string) => Promise<unknown>) => acao(api, "t"),
    },
  };
});
vi.mock("./loja", () => ({ listaDeAmigos: lista.listaDeAmigos }));
vi.mock("@/shared/ui/avisos", () => ({ avisar: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  lista.estado.listas = { amigos: [{ conta_id: "amiga" }], recebidos: [] };
  vi.clearAllMocks();
});

const convite = (id: string, codigo = "ABCDE"): ConviteParaSala => ({ de: { id, nome: "AnaRock", avatar: null }, codigo });
const chegar = (c: ConviteParaSala) => act(() => ouvir.ouvinte!(c));

describe("ConvitesDeAmigos", () => {
  it("convite de amigo aparece no canto e entrar leva à sala", async () => {
    const aoEntrar = vi.fn();
    render(<ConvitesDeAmigos aoEntrar={aoEntrar} />);
    chegar(convite("amiga"));
    expect(screen.getByRole("alert")).toHaveTextContent("AnaRock chamou você para a sala ABCDE");
    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    expect(aoEntrar).toHaveBeenCalledWith("ABCDE");
  });

  it("recusar o convite de sala só fecha o aviso", async () => {
    const aoEntrar = vi.fn();
    render(<ConvitesDeAmigos aoEntrar={aoEntrar} />);
    chegar(convite("amiga"));
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }));
    expect(aoEntrar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("convite de quem não é amigo não aparece", () => {
    render(<ConvitesDeAmigos aoEntrar={vi.fn()} />);
    chegar(convite("estranho"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o mesmo amigo chamando de novo troca o convite, e ele some sozinho", async () => {
    render(<ConvitesDeAmigos aoEntrar={vi.fn()} duracaoMs={50} />);
    chegar(convite("amiga", "ABCDE"));
    chegar(convite("amiga", "FGHJK"));
    expect(screen.getByText("FGHJK")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("ABCDE")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("FGHJK")).not.toBeInTheDocument());
  });

  it("pedido de amizade novo aparece com aceitar e recusar", async () => {
    render(<ConvitesDeAmigos aoEntrar={vi.fn()} />);
    act(() => lista.receber([{ conta_id: "gabi", nome: "GabiStrings", avatar: null }]));
    expect(screen.getByRole("alert")).toHaveTextContent("GabiStrings quer ser seu amigo");
    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    expect(lista.api.aceitar).toHaveBeenCalledWith("t", "gabi");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("recusar o pedido desfaz a amizade pedida", async () => {
    render(<ConvitesDeAmigos aoEntrar={vi.fn()} />);
    act(() => lista.receber([{ conta_id: "gabi", nome: "GabiStrings", avatar: null }]));
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }));
    expect(lista.api.desfazer).toHaveBeenCalledWith("t", "gabi");
  });

  it("pedidos que já esperavam quando o app abriu não viram aviso", () => {
    lista.estado.listas = { amigos: [], recebidos: [{ conta_id: "velho", nome: "Antigo", avatar: null }] };
    render(<ConvitesDeAmigos aoEntrar={vi.fn()} />);
    act(() => lista.receber([{ conta_id: "velho", nome: "Antigo", avatar: null }]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
