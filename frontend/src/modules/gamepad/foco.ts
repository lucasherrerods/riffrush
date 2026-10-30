export type Direcao = "cima" | "baixo" | "esquerda" | "direita";

interface Caixa {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Desalinhado pesa mais que distante: a seta para baixo vai para o de baixo, não para o da diagonal. */
const PESO_DO_DESALINHAMENTO = 2;

/** O índice da caixa mais próxima de `origem` na direção, ou -1 se não há nenhuma. Sem origem, a primeira. */
export function maisProximoNaDirecao(origem: Caixa | null, caixas: Caixa[], direcao: Direcao): number {
  if (!origem) return caixas.length ? 0 : -1;
  const horizontal = direcao === "esquerda" || direcao === "direita";
  const sinal = direcao === "direita" || direcao === "baixo" ? 1 : -1;
  const centro = (c: Caixa) => ({ x: (c.left + c.right) / 2, y: (c.top + c.bottom) / 2 });
  const de = centro(origem);
  let melhor = -1;
  let menor = Infinity;
  caixas.forEach((caixa, i) => {
    if (caixa === origem) return;
    const para = centro(caixa);
    const avanco = (horizontal ? para.x - de.x : para.y - de.y) * sinal;
    if (avanco <= 0) return;
    const desvio = Math.abs(horizontal ? para.y - de.y : para.x - de.x);
    const custo = avanco + desvio * PESO_DO_DESALINHAMENTO;
    if (custo < menor) {
      menor = custo;
      melhor = i;
    }
  });
  return melhor;
}

const FOCAVEIS = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="tab"], [role="radio"], [role="menuitem"], [role="option"]';
const ATIVAVEIS = 'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], input[type="checkbox"], input[type="radio"]';
const CAMPOS_DE_TEXTO = "input:not([type=checkbox]):not([type=radio]), textarea, select";

/** Com uma janela aberta, só ela recebe o foco. */
function escopo() {
  const janelas = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  return janelas[janelas.length - 1] ?? document.body;
}

function visivel(el: HTMLElement) {
  const caixa = el.getBoundingClientRect();
  return caixa.width > 0 && caixa.height > 0 && !el.closest("[inert], [aria-hidden=true]") && !(el as HTMLButtonElement).disabled;
}

const emFoco = () => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);

/** Leva o foco para o elemento mais próximo na direção. Num campo de texto, os lados ficam para o cursor. */
export function moverFoco(direcao: Direcao) {
  const atual = emFoco();
  if (atual?.matches(CAMPOS_DE_TEXTO) && (direcao === "esquerda" || direcao === "direita")) return;
  const elementos = Array.from(escopo().querySelectorAll<HTMLElement>(FOCAVEIS)).filter(visivel);
  const caixas = elementos.map((el) => el.getBoundingClientRect());
  const origem = atual ? caixas[elementos.indexOf(atual)] ?? atual.getBoundingClientRect() : null;
  const indice = maisProximoNaDirecao(origem, caixas, direcao);
  if (indice < 0) return;
  elementos[indice].focus({ focusVisible: true } as FocusOptions);
  elementos[indice].scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

/** O A confirma o que está em foco, como o Enter faria num botão de verdade. */
export function ativarFoco() {
  const atual = emFoco();
  if (atual?.matches(ATIVAVEIS)) atual.click();
}

/** Onde a tecla do controle nasce: no elemento em foco, para abas e listas ouvirem; sem foco, na janela. */
export const alvoDaTecla = (): EventTarget => emFoco() ?? window;
