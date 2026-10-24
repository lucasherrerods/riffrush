/** Um Map com tamanho máximo: passando do limite, sai o valor usado há mais tempo. */
export function criarCacheLimitado<V>(limite: number) {
  // O Map mantém a ordem de inserção: reinserir ao ler deixa o mais usado no fim.
  const valores = new Map<string, V>();
  return {
    ler(chave: string) {
      const valor = valores.get(chave);
      if (valor === undefined) return undefined;
      valores.delete(chave);
      valores.set(chave, valor);
      return valor;
    },
    guardar(chave: string, valor: V) {
      valores.delete(chave);
      valores.set(chave, valor);
      if (valores.size > limite) valores.delete(valores.keys().next().value!);
    },
    apagar(chave: string) {
      valores.delete(chave);
    },
  };
}
