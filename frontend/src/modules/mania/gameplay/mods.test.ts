import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODS, siglasDosMods } from "./mods";

it("as siglas saem na ordem do osu!", () => {
  expect(siglasDosMods(MODS.HD | MODS.DT | MODS.MR)).toEqual(["DT", "HD", "MR"]);
  expect(siglasDosMods(0)).toEqual([]);
});

it("os bits são os mesmos do motor", () => {
  const fonte = readFileSync(resolve(process.cwd(), "../backend/motor-mania/src/mods.rs"), "utf8");
  const doMotor = Object.fromEntries([...fonte.matchAll(/pub const (\w+): Mods = Mods\((?:1 << )?(\d+)\);/g)].map(([, nome, bit]) => [nome, bit]));
  const nomes: Record<string, string> = { MR: "MIRROR", RD: "RANDOM", AT: "AUTOPLAY" };
  for (const [sigla, valor] of Object.entries(MODS)) {
    const bit = doMotor[nomes[sigla] ?? sigla];
    expect(valor, sigla).toBe(bit === "1" && sigla === "EZ" ? 1 : 1 << Number(bit));
  }
});
