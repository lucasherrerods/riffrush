# Design Rules

Regras de design visual seguras para seguir sempre. Baseadas em "Visual design rules you can safely follow every time", de Anthony Hobday (https://anthonyhobday.com/sideprojects/saferules/).

Nenhuma regra é obrigatória: quebre qualquer uma quando houver um bom motivo. Sem um motivo, siga-as.

## Cor

1. **Não use preto puro nem branco puro.** Use quase-preto (ex.: `#111`–`#1a1a1a`) e quase-branco (ex.: `#fafafa`). O preto puro cria contraste agressivo e o branco puro é brilhante demais.
2. **Sature os neutros.** Adicione um leve tom da cor principal aos cinzas, brancos e pretos (saturação HSB abaixo de ~5%).
3. **Tons quentes OU frios, nunca os dois.** Se saturar os neutros, escolha uma única temperatura.
4. **Cores da paleta com brilho distinto.** Cada cor deve ter um valor de brilho diferente, para que não disputem atenção.
5. **Alto contraste para o que importa.** Botões e conteúdo principal com contraste alto. Elementos estruturais e sombras com o menor contraste possível.
6. **Brilho do container dentro de limites.** A diferença de brilho HSB entre o container e o fundo deve ser de até **12% no modo escuro** e até **7% no modo claro**.
7. **Elementos mais próximos são mais claros.** Vale tanto no tema claro quanto no escuro (elevação = mais claro).
8. **Ícones ao lado de texto com menos contraste.** Ícones pesam mais que o texto, então reduza a opacidade ou o contraste deles.

## Bordas, profundidade e sombras

9. **A borda contrasta com o container e com o fundo.** No escuro, a borda é mais clara que os dois. No claro, é mais escura que os dois.
10. **O blur da sombra é o dobro do deslocamento Y.** Ex.: `0 4px 8px`. Quanto mais "perto" do usuário estiver o elemento, menor a opacidade da sombra.
11. **Sem sombras em interfaces escuras.** Use diferença de brilho para criar elevação.
12. **Não misture técnicas de profundidade.** Escolha uma (ex.: sombras suaves) e use-a de forma consistente.
13. **Não coloque dois divisores rígidos lado a lado.** Mudança de fundo, borda de container e linha divisória são divisores rígidos. Use apenas um por vez.
14. **Cantos aninhados:** raio interno = raio externo − espaçamento entre eles. Ex.: externo 30px, gap 20px → interno 10px.

## Layout e espaçamento

15. **Seja deliberado em tudo.** Espaço em branco, alinhamento, tamanho, espaçamento, cor e sombra precisam ter um motivo que você consiga explicar.
16. **Alinhe tudo com alguma coisa.** Elementos desalinhados parecem não pertencer ao layout.
17. **O alinhamento óptico costuma vencer o matemático.** Ajuste no olho quando a forma parecer descentralizada (ex.: ícone de play).
18. **Medidas relacionadas matematicamente.** Use uma escala de espaçamento e tamanho (ex.: múltiplos de 4/8: 8, 16, 24, 32, 48, 64).
19. **Grid de 12 colunas** quando usar grid horizontal (divide em 1, 2, 3, 4 e 6).
20. **Meça o espaço entre pontos de alto contraste.** Meça a partir da borda visível (ex.: do fim do texto até o início do fundo escuro), não da caixa invisível.
21. **Padding externo ≥ padding interno.** Assim os elementos relacionados continuam agrupados.
22. **Ordene por peso visual.** Em uma linha ou coluna, o elemento mais pesado vem primeiro e fica na borda externa.
23. **Simples sobre complexo, ou complexo sobre simples.** Nunca complexo sobre complexo (ex.: texto detalhado sobre foto movimentada).

## Tipografia

24. **Texto do corpo com no mínimo 16px.**
25. **Linha com cerca de 70 caracteres.** 60–80 é aceitável (`max-width: ~65ch–70ch`).
26. **Texto grande com menos letter-spacing e line-height. Texto pequeno com mais.** Ex.: títulos com `line-height: 1.1` e `letter-spacing: -0.02em`. Corpo com `line-height: 1.5–1.6`.
27. **No máximo duas fontes.**

## Componentes

28. **Padding horizontal do botão = 2× o vertical.** Ex.: `padding: 12px 24px`.

---

## Checklist rápido

- [ ] Sem `#000` / `#fff` puros. Neutros levemente tingidos, com uma única temperatura
- [ ] Espaçamentos e tamanhos em uma escala (4/8)
- [ ] Corpo ≥ 16px, linhas com ~70ch, no máximo 2 fontes
- [ ] Botões com padding `y : x = 1 : 2`
- [ ] Sombras com `blur = 2 × y`, uma única técnica de profundidade e nenhuma sombra no dark mode
- [ ] Container vs. fundo: Δ de brilho ≤ 7% (claro) / ≤ 12% (escuro)
- [ ] Raios aninhados: `interno = externo − gap`
- [ ] Nunca dois divisores rígidos juntos
- [ ] Ícones junto ao texto com contraste reduzido
- [ ] Tudo alinhado a alguma coisa, e cada decisão tem justificativa

## Temas e skins

Toda cor do app mora num arquivo de tema, e o teste `coresSoltas.test.ts` barra cor fora deles:

- `src/shared/styles/temas.ts`: as cores da interface (`cores`) e a skin da pista do Rock (`pista`). Para criar um tema, copie um existente, troque os valores e registre-o em `TEMAS`. Os testes de `tokens.test.ts` conferem as regras deste documento em todos os temas, inclusive o contraste AA (4,5:1) do texto.
- `src/modules/<modo>/tema.ts`: as cores que só o canvas de cada jogo usa (cenas 3D, instrumentos, personagem, capas).

O tema da interface troca na hora com `definirTema()` (`src/shared/styles/tema.ts`): cada modo de jogo tem o seu, e o App veste a interface com o tema do modo ativo. O Rock usa o Riff Rush; o Mania, o Riff Rush Mania.

### Tema claro (Riff Rush Mania)

Rosa e branco, com neutros quentes tingidos de rosa. As regras de cor valem como no escuro, com as diferenças que o próprio documento prevê:

- container vs. fundo com Δ de brilho de até 7% (regra 6), e a elevação continua mais clara (regra 7);
- a borda é mais escura que o fundo e as superfícies (regra 9);
- no claro, sombras suaves são permitidas (regras 10 e 12). Os temas escuros continuam sem sombra.

O brilho neon continua só no canvas da pista.

## Palco (exceções deliberadas)

O visual do jogo é um show de rock. Estas regras quebram as de cima de propósito, sempre com o mesmo motivo: ambientação de palco.

- **Iluminação de palco:** feixes de holofote (`.holofote`) e luz no chão só no **fundo** das telas, atrás de tudo. Componentes continuam sem sombra (regra 11): a elevação segue vindo do brilho.
- **Três fontes (regra 27):** `--font-letreiro` (Rubik Dirt) só no título de cada tela (`h1`); `--font-titulo` (Bebas Neue) em subtítulos e números de jogo; Geist no texto corrido. Fonte suja nunca em texto longo ou em número que precisa ser lido rápido.
- **Texturas:** painéis usam `.placa` (painel principal: metal escovado, rebites, quinas de 16px) e `.chapa` (itens e cartões: metal escovado, quinas de 8px). Áreas pintadas de cor cheia usam `.gasto`. Não empilhe textura sobre textura (regra 23).
