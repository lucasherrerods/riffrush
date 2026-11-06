import { assistirNoModoCerto, tirarPedidoDeAssistir } from "./assistirEmOutroModo";
import type { PessoaOnline } from "./protocolo";

const pessoa = (modo?: "rock" | "mania"): PessoaOnline => ({ id: "a", nome: "Ana", avatar: null, estado: { tipo: "menu", modo } });

it("no mesmo modo abre aqui e não guarda nada", () => {
  const abrir = vi.fn();
  const trocar = vi.fn();
  assistirNoModoCerto(pessoa("mania"), "mania", abrir, trocar);
  expect(abrir).toHaveBeenCalled();
  expect(trocar).not.toHaveBeenCalled();
  expect(tirarPedidoDeAssistir()).toBeNull();
});

it("no outro modo troca e guarda o pedido para uma vez; sem modo é o Rock", () => {
  const abrir = vi.fn();
  const trocar = vi.fn();
  assistirNoModoCerto(pessoa(), "mania", abrir, trocar);
  expect(trocar).toHaveBeenCalledWith("rock");
  expect(abrir).not.toHaveBeenCalled();
  expect(tirarPedidoDeAssistir()?.nome).toBe("Ana");
  expect(tirarPedidoDeAssistir()).toBeNull();
});
