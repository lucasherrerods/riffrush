import { fireEvent, render } from "@testing-library/react";
import { VideoDoPalco } from "./VideoDoPalco";

describe("VideoDoPalco", () => {
  it("toca o show em loop, mudo e sem receber toques", () => {
    const { container } = render(<VideoDoPalco aoFalhar={() => {}} />);
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).toHaveClass("pointer-events-none");
  });

  it("avisa quando o vídeo não pode tocar, para o palco 3D entrar no lugar", () => {
    const aoFalhar = vi.fn();
    const { container } = render(<VideoDoPalco aoFalhar={aoFalhar} />);
    fireEvent.error(container.querySelector("video")!);
    expect(aoFalhar).toHaveBeenCalled();
  });
});
