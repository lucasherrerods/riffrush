import { act, render, screen } from "@testing-library/react";
import { AudioContextFalso } from "@/test/audioFalso";
import { IndicadorDeVolume, TEMPO_DO_INDICADOR_MS } from "./IndicadorDeVolume";
import { definirVolumeGeral, instalarAtalhosDeVolume } from "./volume";

vi.stubGlobal("AudioContext", AudioContextFalso);

const altRoda = (deltaY: number) => document.body.dispatchEvent(new WheelEvent("wheel", { deltaY, altKey: true, cancelable: true, bubbles: true }));

describe("IndicadorDeVolume", () => {
  let desinstalar: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    definirVolumeGeral(0.5);
    desinstalar = instalarAtalhosDeVolume(window);
  });
  afterEach(() => {
    desinstalar();
    vi.useRealTimers();
  });

  it("aparece com o volume novo quando o atalho muda o volume, e some sozinho", () => {
    render(<IndicadorDeVolume />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => void altRoda(-100));
    expect(screen.getByRole("status", { name: "Volume 55%" })).toHaveTextContent("55%");
    act(() => void vi.advanceTimersByTime(TEMPO_DO_INDICADOR_MS + 500));
    expect(screen.queryByRole("status", { name: /Volume/ })).not.toBeInTheDocument();
  });

  it("mudar o volume pelo controle da tela não abre o indicador", () => {
    render(<IndicadorDeVolume />);
    act(() => definirVolumeGeral(0.2));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
