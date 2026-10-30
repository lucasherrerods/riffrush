import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { abrirLink } from "@/modules/platform";
import { CartaoDaConta, URL_DA_AJUDA } from "./CartaoDaConta";

vi.mock("@/modules/platform", () => ({ abrirLink: vi.fn(async () => {}) }));
import { sessaoDaConta } from "./sessao";

const conta = { id: "1", nome: "Lucas", avatar: null, email: "lucas@exemplo.com", xp_total: 0, nivel: { nivel: 3, xp_no_nivel: 10, xp_para_o_proximo: 100 } };

describe("CartaoDaConta", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sem conta, mostra o botão do Google que inicia o login", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta: null, carregando: false });
    const entrar = vi.spyOn(sessaoDaConta, "entrar").mockResolvedValue();
    render(<CartaoDaConta aoVerPerfil={() => {}} aoConfigurar={() => {}} />);

    const botao = screen.getByRole("button", { name: "Entrar com Google" });
    expect(botao).toHaveTextContent("Google");
    await userEvent.setup().click(botao);
    expect(entrar).toHaveBeenCalled();
  });

  it("mostra nome e nível num botão que abre o menu com a opção de sair", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta, carregando: false });
    const sair = vi.spyOn(sessaoDaConta, "sair").mockResolvedValue();
    const usuario = userEvent.setup();
    render(<CartaoDaConta aoVerPerfil={() => {}} aoConfigurar={() => {}} />);

    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Nv 3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Lucas/ }));
    expect(screen.getByText("lucas@exemplo.com")).toBeInTheDocument();
    await usuario.click(screen.getByRole("menuitem", { name: "Sair da conta" }));
    expect(sair).toHaveBeenCalled();
  });

  it("ver perfil no menu chama aoVerPerfil", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta, carregando: false });
    const aoVerPerfil = vi.fn();
    const usuario = userEvent.setup();
    render(<CartaoDaConta aoVerPerfil={aoVerPerfil} aoConfigurar={() => {}} />);

    await usuario.click(screen.getByRole("button", { name: /Lucas/ }));
    await usuario.click(screen.getByRole("menuitem", { name: "Ver perfil" }));
    expect(aoVerPerfil).toHaveBeenCalled();
  });

  it("configurações fica no menu, logo abaixo de ver perfil", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta, carregando: false });
    const aoConfigurar = vi.fn();
    const usuario = userEvent.setup();
    render(<CartaoDaConta aoVerPerfil={() => {}} aoConfigurar={aoConfigurar} />);

    await usuario.click(screen.getByRole("button", { name: /Lucas/ }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent).slice(0, 2)).toEqual(["Ver perfil", "Configurações"]);
    await usuario.click(screen.getByRole("menuitem", { name: "Configurações" }));
    expect(aoConfigurar).toHaveBeenCalled();
  });

  it("ajuda no menu abre as issues do projeto", async () => {
    vi.spyOn(sessaoDaConta, "estado").mockReturnValue({ conta, carregando: false });
    const usuario = userEvent.setup();
    render(<CartaoDaConta aoVerPerfil={() => {}} aoConfigurar={() => {}} />);

    await usuario.click(screen.getByRole("button", { name: /Lucas/ }));
    await usuario.click(screen.getByRole("menuitem", { name: "Ajuda" }));
    expect(abrirLink).toHaveBeenCalledWith(URL_DA_AJUDA);
    expect(URL_DA_AJUDA).toBe("https://github.com/lucasherrerods/riffrush/issues");
  });
});
