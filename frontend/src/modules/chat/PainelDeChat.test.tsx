import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VolumeX } from "lucide-react";
import { PainelDeChat, type MensagemDoChat } from "./PainelDeChat";

const MENSAGENS: MensagemDoChat[] = [
  { id: "1", autor: "Lucas", texto: "bora jogar?" },
  { id: "2", autor: "Vitor", texto: "bora", minha: true },
];

describe("PainelDeChat", () => {
  it("mostra as mensagens com quem mandou", () => {
    render(<PainelDeChat titulo="Chat da sala" mensagens={MENSAGENS} aoEnviar={vi.fn()} />);
    const log = screen.getByRole("log", { name: "Chat da sala" });
    expect(within(log).getByText("Lucas")).toBeInTheDocument();
    expect(within(log).getByText("bora jogar?")).toBeInTheDocument();
  });

  it("texto com cara de HTML aparece como texto, sem virar elemento", () => {
    const html = '<img src=x onerror="alert(1)">';
    render(<PainelDeChat titulo="Chat" mensagens={[{ id: "1", autor: "x", texto: html }]} aoEnviar={vi.fn()} />);
    expect(screen.getByText(html)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("envia o texto limpo com Enter e limpa o campo", async () => {
    const aoEnviar = vi.fn(() => true);
    render(<PainelDeChat titulo="Chat" mensagens={[]} aoEnviar={aoEnviar} />);
    const campo = screen.getByRole("textbox", { name: "Mensagem" });
    await userEvent.type(campo, "  oi  {Enter}");
    expect(aoEnviar).toHaveBeenCalledWith("oi");
    expect(campo).toHaveValue("");
  });

  it("não envia mensagem vazia", async () => {
    const aoEnviar = vi.fn(() => true);
    render(<PainelDeChat titulo="Chat" mensagens={[]} aoEnviar={aoEnviar} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Mensagem" }), "   {Enter}");
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it("acima do limite, guarda o texto e avisa para esperar", async () => {
    render(<PainelDeChat titulo="Chat" mensagens={[]} aoEnviar={() => false} />);
    const campo = screen.getByRole("textbox", { name: "Mensagem" });
    await userEvent.type(campo, "oi{Enter}");
    expect(campo).toHaveValue("oi");
    expect(screen.getByText(/devagar/i)).toBeInTheDocument();
  });

  it("as teclas digitadas não chegam nos atalhos das telas", () => {
    const daTela = vi.fn();
    window.addEventListener("keydown", daTela);
    render(<PainelDeChat titulo="Chat" mensagens={[]} aoEnviar={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensagem" }), { key: "Enter", code: "Enter" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensagem" }), { key: "ArrowDown", code: "ArrowDown" });
    expect(daTela).not.toHaveBeenCalled();
    window.removeEventListener("keydown", daTela);
  });

  it("o campo aceita no máximo o tamanho de uma mensagem", () => {
    render(<PainelDeChat titulo="Chat" mensagens={[]} aoEnviar={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toHaveAttribute("maxLength", "200");
  });

  it("bloqueado, mostra o motivo no lugar do campo", () => {
    render(<PainelDeChat titulo="Chat" mensagens={MENSAGENS} aoEnviar={vi.fn()} bloqueado="Entre com a sua conta para conversar." />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Entre com a sua conta para conversar.")).toBeInTheDocument();
  });

  it("mostra as ações de cada mensagem e o selo ao lado do nome", async () => {
    const aoClicar = vi.fn();
    const mensagens = [{ ...MENSAGENS[0], selo: "Moderação" }, MENSAGENS[1]];
    render(<PainelDeChat titulo="Chat" mensagens={mensagens} aoEnviar={vi.fn()} acoesDaMensagem={(m) => (m.minha ? [] : [{ rotulo: `Silenciar ${m.autor}`, icone: VolumeX, aoClicar }])} />);
    expect(screen.getByText("Moderação")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Silenciar Vitor" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Silenciar Lucas" }));
    expect(aoClicar).toHaveBeenCalled();
  });

  it("mostra o aviso fixo acima do campo", () => {
    render(<PainelDeChat titulo="Chat" mensagens={[]} aoEnviar={vi.fn()} aviso="A moderação nunca pede senha." />);
    expect(screen.getByText("A moderação nunca pede senha.")).toBeInTheDocument();
  });

  it("com minimizar, a setinha esconde as mensagens e o campo, e mostra de novo", async () => {
    const aoAlternar = vi.fn();
    const { rerender } = render(<PainelDeChat titulo="Chat global" mensagens={[{ id: "1", autor: "Ana", texto: "oi" }]} aoEnviar={vi.fn()} minimizar={{ minimizado: false, aoAlternar }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Minimizar o chat global" }));
    expect(aoAlternar).toHaveBeenCalledWith(true);

    rerender(<PainelDeChat titulo="Chat global" mensagens={[{ id: "1", autor: "Ana", texto: "oi" }]} aoEnviar={vi.fn()} minimizar={{ minimizado: true, aoAlternar }} />);
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Mensagem" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir o chat global" })).toHaveAttribute("aria-expanded", "false");
  });

  it("sem minimizar, não tem setinha", () => {
    render(<PainelDeChat titulo="Chat da sala" mensagens={[]} aoEnviar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Minimizar/ })).not.toBeInTheDocument();
  });
});
