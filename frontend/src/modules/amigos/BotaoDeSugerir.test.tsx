import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SugestaoDeMusica } from "@/modules/presenca";
import type { ApiDosAmigos, PessoaDaAmizade } from "./api";
import { BotaoDeSugerir } from "./BotaoDeSugerir";

const pessoa = (conta_id: string, nome: string): PessoaDaAmizade => ({ conta_id, nome, avatar: null, nivel: 3, visto_em: null, desde: "2026-10-01T00:00:00Z" });

const falsos = vi.hoisted(() => ({
  conta: { id: "eu", nome: "Eu" } as { id: string; nome: string } | null,
  enviar: vi.fn(async () => true),
  listas: vi.fn(),
}));

vi.mock("@/modules/conta", () => ({ useConta: () => ({ conta: falsos.conta }) }));
vi.mock("./loja", async () => {
  const { ListaDeAmigos } = await vi.importActual<typeof import("./lista")>("./lista");
  const api = { listas: falsos.listas, sugestoes: vi.fn(async () => []) };
  return { listaDeAmigos: new ListaDeAmigos(api as unknown as ApiDosAmigos, () => "t"), conversas: { enviar: falsos.enviar } };
});

const sugestao: SugestaoDeMusica = { modo: "rock", musica: "fb0079d4c2e025d5b8dd70724750a923", versao: "expert", titulo: "Through the Fire", artista: "DragonForce", dificuldade: "Expert · Guitarra" };

beforeEach(() => {
  falsos.conta = { id: "eu", nome: "Eu" };
  falsos.enviar.mockClear();
  falsos.listas.mockResolvedValue({ codigo: "RIFF-1", amigos: [pessoa("a", "AnaRock"), pessoa("r", "RafaBass")], recebidos: [], enviados: [], bloqueados: [] });
});

it("manda a música para os amigos escolhidos, com o recado", async () => {
  const usuario = userEvent.setup();
  render(<BotaoDeSugerir sugestao={sugestao} />);
  await usuario.click(screen.getByRole("button", { name: "Sugerir para um amigo" }));
  await usuario.click(await screen.findByRole("checkbox", { name: "AnaRock" }));
  await usuario.click(screen.getByRole("checkbox", { name: "RafaBass" }));
  await usuario.type(screen.getByRole("textbox", { name: "Recado" }), "bate meu recorde");
  await usuario.click(screen.getByRole("button", { name: /Enviar/ }));
  expect(falsos.enviar).toHaveBeenCalledWith("a", "bate meu recorde", sugestao);
  expect(falsos.enviar).toHaveBeenCalledWith("r", "bate meu recorde", sugestao);
});

it("o Enter no recado não escapa para a seleção, que tocaria a música", async () => {
  const usuario = userEvent.setup();
  const naJanela = vi.fn();
  window.addEventListener("keydown", naJanela);
  render(<BotaoDeSugerir sugestao={sugestao} />);
  await usuario.click(screen.getByRole("button", { name: "Sugerir para um amigo" }));
  await usuario.type(await screen.findByRole("textbox", { name: "Recado" }), "oi{Enter}");
  window.removeEventListener("keydown", naJanela);
  expect(naJanela).not.toHaveBeenCalled();
});

it("sem uma música que o amigo consiga baixar, o botão fica desligado com o motivo", () => {
  render(<BotaoDeSugerir sugestao={null} motivoSemSugestao="Só dá para sugerir músicas baixadas do Encore." />);
  const botao = screen.getByRole("button", { name: "Sugerir para um amigo" });
  expect(botao).toBeDisabled();
  expect(botao).toHaveAttribute("title", "Só dá para sugerir músicas baixadas do Encore.");
});

it("sem conta, o botão não aparece", () => {
  falsos.conta = null;
  render(<BotaoDeSugerir sugestao={sugestao} />);
  expect(screen.queryByRole("button", { name: "Sugerir para um amigo" })).toBeNull();
});
