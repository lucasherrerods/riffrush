/**
 * Script que vai no <head> do index.html: pinta o fundo com a cor do modo salvo antes de o JS do app chegar,
 * para o primeiro quadro não ser uma tela branca. Fica sem imports para o vite.config usá-lo.
 */
export function scriptDoFundoInicial(cores: { rock: string; mania: string }, chaveDoModo: string) {
  return `try{var m=localStorage.getItem(${JSON.stringify(chaveDoModo)})}catch(e){}document.documentElement.style.backgroundColor=m==="mania"?${JSON.stringify(cores.mania)}:${JSON.stringify(cores.rock)};`;
}
