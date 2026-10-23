# Riff Rush

Jogo de ritmo estilo Guitar Hero / Clone Hero para desktop (Tauri) com multijogador em LAN de até 4 jogadores. Celulares na mesma rede jogam pelo navegador, servidos pelo app do host.

## Stack

- Tauri 2 (Rust) + React 19 + TypeScript + Vite
- Tailwind CSS 4 + shadcn/ui + lucide-react + framer-motion
- Vitest + Testing Library

## Comandos

```bash
npm run tauri dev   # abre o app desktop
npm test            # roda os testes uma vez
npm run test:watch  # testes em modo watch
npm run build       # typecheck + build web (também é a versão servida aos celulares)
cargo test --manifest-path src-tauri/Cargo.toml   # testes do lado Rust
```

## Estrutura

```
src/
  app/            composição das telas e navegação
  shared/         ui (shadcn), utilitários e estilos globais
  modules/<nome>/ uma pasta por funcionalidade
src-tauri/        lado nativo (Rust)
docs/design.md    regras visuais
```

Cada módulo expõe sua API pública em `index.ts`. Outros módulos importam só desse arquivo, nunca de arquivos internos.

## Regras

### TDD
- Escreva o teste antes da funcionalidade. O teste falha, o código o faz passar, depois refatore.
- Todo bug corrigido ganha um teste que reproduz o problema, para ele não voltar.
- Lógica (cálculos, parsers, regras do jogo) fica em funções puras testáveis, fora dos componentes.
- Testes ficam ao lado do arquivo testado: `arquivo.ts` → `arquivo.test.ts`.

### Código
- Nunca duplique código ou componentes. Se algo se repete, extraia para o módulo dono ou para `shared/`.
- Pastas em inglês (`shared`, `modules`, `styles`).
- O resto em português: nomes de arquivos, funções, variáveis, componentes, textos da interface e testes. Termos de bibliotecas e do React continuam como são.
- Comentários só quando explicam algo que o código não mostra, em frases simples.

### Design
- Toda mudança de interface segue `docs/design.md`.
- Use os tokens de cor e espaçamento definidos em `src/shared/styles`, nunca cores soltas.
- Exceção: o brilho neon é permitido apenas dentro do canvas da pista (notas, explosões, trilhos), por ser efeito de jogo. Menus, painéis e botões seguem a regra de não usar sombras no tema escuro.

### Economia de tokens
- Durante o trabalho, rode só o teste do arquivo alterado (`npx vitest run caminho/arquivo.test.ts`). A suíte inteira roda só no final.
- Use saídas curtas: `npm test -- --reporter=dot` e `cargo test -q`.
- Não rode `npm run build` a cada passo, só antes do PR.
- Leia `docs/design.md` só quando a mudança for de interface.
- Não leia nem busque em `node_modules`, `dist`, `coverage`, `src-tauri/target` e arquivos de áudio.

### Git
- Commits convencionais, curtos e em português: `feat: adiciona sustain nas notas`, `fix: corrige atraso do input`, `test: cobre parser de .chart`.
- Nunca adicione co-autor nos commits nem assinatura nas descrições de PR.
- Um PR por funcionalidade ou pedido, sem misturar contextos. Abra o PR ao terminar.
- Cada PR parte da `main` atualizada.
