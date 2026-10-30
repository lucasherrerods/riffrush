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
vi.mock("./loja", () => ({
  listaDeAmigos: { estado: () => ({ listas: { amigos: [{ conta_id: "amiga" }] } }) },
}));

const convite = (id: string, codigo = "ABCDE"): ConviteParaSala => ({ de: { id, nome: "AnaRock", avatar: null }, codigo });
const chegar = (c: ConviteParaSala) => act(() => ouvir.ouvinte!(c));

describe("ConvitesDeAmigos", () => {
  it("convite de amigo aparece no canto e entrar leva à sala", async () => {
    const aoEntrar = vi.fn();
    render(<ConvitesDeAmigos aoEntrar={aoEntrar} />);
    chegar(convite("amiga"));
    expect(screen.getByRole("alert")).toHaveTextContent("AnaRock chamou você para a sala ABCDE");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(aoEntrar).toHaveBeenCalledWith("ABCDE");
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
});
