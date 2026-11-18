import { act, render, screen } from "@testing-library/react";
import { criarLojaDoHud } from "../lojaDoHud";
import { PosicaoNaTelaDividida } from "./PosicaoNaTelaDividida";

describe("PosicaoNaTelaDividida", () => {
  it("mostra a posição ao vivo de cada coluna e troca quando alguém ultrapassa", () => {
    const lojas = [criarLojaDoHud({ pontos: 100 }), criarLojaDoHud({ pontos: 200 })];
    render(
      <>
        <PosicaoNaTelaDividida lojas={lojas} indice={0} nome="Ana" />
        <PosicaoNaTelaDividida lojas={lojas} indice={1} nome="Lu" />
      </>,
    );
    expect(screen.getByLabelText("Ana em 2º")).toBeInTheDocument();
    expect(screen.getByLabelText("Lu em 1º")).toBeInTheDocument();
    act(() => lojas[0].definir({ pontos: 300 }));
    expect(screen.getByLabelText("Ana em 1º")).toBeInTheDocument();
    expect(screen.getByLabelText("Lu em 2º")).toBeInTheDocument();
  });
});
