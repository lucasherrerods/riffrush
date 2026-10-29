use std::collections::{HashMap, HashSet};

/// Até onde, em segundos de cada lado da batida, o toque ganha cada julgamento.
const JANELA_DO_PERFEITO: f64 = 0.035;
const JANELA_DO_OTIMO: f64 = 0.07;
pub const JANELA_DE_ACERTO: f64 = 0.11;
const VIDA_INICIAL: f64 = 0.5;
const VIDA_POR_ACERTO: f64 = 0.02;
const VIDA_POR_ERRO: f64 = 0.03;
const PONTOS_POR_NOTA: f64 = 50.0;
const PONTOS_POR_SEGUNDO_DE_SUSTAIN: f64 = 40.0;
const ESTRELA_POR_FRASE: f64 = 0.25;
const ESTRELA_MINIMA: f64 = 0.5;
/// A cada tantas notas seguidas o app comemora a sequência.
const AVISO_DE_SEQUENCIA: u32 = 50;
const DURACAO_DA_ESTRELA: f64 = 16.0;
const TOLERANCIA_DO_SUSTAIN: f64 = 0.1;
const TICKS_POR_SEGUNDO: f64 = 1000.0;
const ESTRELA_CHEIA: f64 = DURACAO_DA_ESTRELA * TICKS_POR_SEGUNDO;
pub const PISTA_ABERTA: u8 = 5;

/// O `Math.round` do JavaScript: o meio vai para cima também nos negativos, ao contrário do `f64::round`.
fn arredondar(x: f64) -> f64 {
    (x + 0.5).floor()
}

pub fn quantizar(tempo: f64) -> f64 {
    arredondar(tempo * TICKS_POR_SEGUNDO) / TICKS_POR_SEGUNDO
}

fn ticks_entre(de: f64, ate: f64) -> f64 {
    arredondar((ate - de) * TICKS_POR_SEGUNDO)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Julgamento {
    Perfeito,
    Otimo,
    Bom,
}

impl Julgamento {
    /// Quanto vale na precisão, como no osu!mania. A nota perdida vale zero.
    pub fn valor(self) -> u32 {
        match self {
            Self::Perfeito => 300,
            Self::Otimo => 200,
            Self::Bom => 100,
        }
    }
}

/// O julgamento de um toque a `distancia` segundos da batida, para qualquer lado. Compara em ticks.
pub fn julgar(distancia: f64) -> Julgamento {
    let ticks = arredondar(distancia * TICKS_POR_SEGUNDO).abs();
    if ticks <= JANELA_DO_PERFEITO * TICKS_POR_SEGUNDO {
        Julgamento::Perfeito
    } else if ticks <= JANELA_DO_OTIMO * TICKS_POR_SEGUNDO {
        Julgamento::Otimo
    } else {
        Julgamento::Bom
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Nota {
    pub tempo: f64,
    pub pista: u8,
    /// Notas da mesma frase de star power têm o mesmo id; -1 é nota comum.
    pub frase: i32,
    pub duracao: f64,
}

#[derive(Debug, Clone)]
pub struct NotaEmJogo {
    pub tempo: f64,
    pub pista: u8,
    pub frase: i32,
    pub duracao: f64,
    pub acertada: bool,
    pub perdida: bool,
    pub segurando: bool,
    /// Sustain largado antes do fim.
    pub solta: bool,
    /// Até onde o sustain já rendeu pontos.
    pub segurou_ate: f64,
}

/// Como as teclas viram notas.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum JeitoDeJogar {
    /// Cada aperto acerta uma nota, e só uma.
    Tapping,
    /// Soltar a tecla depois de um acerto também acerta a próxima nota da pista.
    #[default]
    Gamepad,
    /// Os trastes só ficam apertados; a palheta toca o acorde que eles formam.
    Palhetada,
}

#[derive(Debug, Clone, Copy)]
pub struct OpcoesDaPartida {
    pub sem_falha: bool,
    /// Multijogador: a vida zerada não tira da música, só deixa a marca de fantasma.
    pub fantasma: bool,
    /// Velocidade da música (1 é a normal). As notas vêm no tempo da música e a partida roda no tempo
    /// real: com a música a 1,5x, uma nota no segundo 3 da música chega no segundo 2. Os pontos são
    /// multiplicados por ela, então a música mais lenta rende menos e a mais rápida, mais.
    pub velocidade: f64,
    /// A nota aberta vira verde. Não muda quantas notas a música tem, então a partida vale igual.
    pub sem_aberta: bool,
    pub jeito: JeitoDeJogar,
}

impl Default for OpcoesDaPartida {
    fn default() -> Self {
        Self {
            sem_falha: false,
            fantasma: false,
            velocidade: 1.0,
            sem_aberta: false,
            jeito: JeitoDeJogar::Gamepad,
        }
    }
}

/// As velocidades que o jogo oferece. Outra é replay adulterado.
pub const VELOCIDADES: [f64; 5] = [0.5, 0.75, 1.0, 1.25, 1.5];

/// O que a partida conta para o app tocar sons e mostrar avisos. A API ignora.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Evento {
    /// `nota` é o índice em `Partida::notas`.
    Acerto {
        nota: usize,
        julgamento: Julgamento,
    },
    Erro {
        nota: usize,
    },
    Sequencia(u32),
    FraseCompleta,
    EstrelaPronta,
    EstrelaAtivada,
    Derrota,
    VirouFantasma,
}

#[derive(Debug, Clone)]
pub struct Partida {
    pub notas: Vec<NotaEmJogo>,
    /// Índice da primeira nota que ainda importa; as anteriores já passaram.
    pub primeira: usize,
    pub tempo: Option<f64>,
    pub pontos: f64,
    pontos_das_notas: f64,
    /// Ticks de sustain segurados, cada um vezes o multiplicador da hora.
    sustain_ponderado: f64,
    pub sequencia: u32,
    pub maior_sequencia: u32,
    pub acertos: u32,
    pub perfeitos: u32,
    pub otimos: u32,
    pub bons: u32,
    /// Soma do valor de cada acerto, para a precisão.
    pub valor_dos_acertos: u32,
    /// Notas que passaram sem ser tocadas.
    pub erros: u32,
    pub vida: f64,
    /// Quantos ticks de star power ativado a barra ainda rende.
    pub estrela_em_ticks: f64,
    pub estrela_ativa: bool,
    pub derrota: bool,
    sem_falha: bool,
    velocidade: f64,
    modo_fantasma: bool,
    /// A vida zerou em algum momento.
    pub fantasma: bool,
    tamanho_das_frases: HashMap<i32, u32>,
    acertos_por_frase: HashMap<i32, u32>,
    pub frases_falhas: HashSet<i32>,
    /// Pistas cujo último aperto acertou uma nota: soltar a tecla pode acertar mais uma.
    armadas: HashSet<u8>,
    jeito: JeitoDeJogar,
    /// Na palhetada, os trastes que estão apertados agora.
    apertados: HashSet<u8>,
    eventos: Vec<Evento>,
}

pub fn criar_partida(notas: &[Nota], opcoes: OpcoesDaPartida) -> Partida {
    let mut tamanho_das_frases = HashMap::new();
    for nota in notas.iter().filter(|n| n.frase >= 0) {
        *tamanho_das_frases.entry(nota.frase).or_insert(0) += 1;
    }
    Partida {
        notas: notas
            .iter()
            .map(|n| {
                let tempo = quantizar(n.tempo / opcoes.velocidade);
                NotaEmJogo {
                    tempo,
                    pista: if opcoes.sem_aberta && n.pista == PISTA_ABERTA { 0 } else { n.pista },
                    frase: n.frase,
                    duracao: quantizar((n.tempo + n.duracao) / opcoes.velocidade) - tempo,
                    acertada: false,
                    perdida: false,
                    segurando: false,
                    solta: false,
                    segurou_ate: tempo,
                }
            })
            .collect(),
        primeira: 0,
        tempo: None,
        pontos: 0.0,
        pontos_das_notas: 0.0,
        sustain_ponderado: 0.0,
        sequencia: 0,
        maior_sequencia: 0,
        acertos: 0,
        perfeitos: 0,
        otimos: 0,
        bons: 0,
        valor_dos_acertos: 0,
        erros: 0,
        vida: VIDA_INICIAL,
        estrela_em_ticks: 0.0,
        estrela_ativa: false,
        derrota: false,
        sem_falha: opcoes.sem_falha,
        velocidade: opcoes.velocidade,
        modo_fantasma: opcoes.fantasma,
        fantasma: false,
        tamanho_das_frases,
        acertos_por_frase: HashMap::new(),
        frases_falhas: HashSet::new(),
        armadas: HashSet::new(),
        jeito: opcoes.jeito,
        apertados: HashSet::new(),
        eventos: Vec::new(),
    }
}

pub fn multiplicador(partida: &Partida) -> f64 {
    let base = (1 + partida.sequencia / 10).min(4);
    f64::from(base * if partida.estrela_ativa { 2 } else { 1 })
}

/// Valor dos acertos sobre o máximo das notas que já passaram (0 a 1).
pub fn precisao(partida: &Partida) -> f64 {
    let tocadas = partida.acertos + partida.erros;
    if tocadas == 0 {
        return 1.0;
    }
    f64::from(partida.valor_dos_acertos) / (f64::from(tocadas) * f64::from(Julgamento::Perfeito.valor()))
}

/// Os eventos acumulados desde a última chamada.
pub fn retirar_eventos(partida: &mut Partida) -> Vec<Evento> {
    std::mem::take(&mut partida.eventos)
}

/// De 0 a 1: quanto da barra de star power está cheia.
pub fn estrela(partida: &Partida) -> f64 {
    partida.estrela_em_ticks / ESTRELA_CHEIA
}

fn contar_frase(partida: &mut Partida, frase: i32) {
    if frase < 0 || partida.frases_falhas.contains(&frase) {
        return;
    }
    let acertos = partida.acertos_por_frase.entry(frase).or_insert(0);
    *acertos += 1;
    if Some(&*acertos) < partida.tamanho_das_frases.get(&frase) {
        return;
    }
    let antes = estrela(partida);
    partida.estrela_em_ticks = ESTRELA_CHEIA.min(partida.estrela_em_ticks + ESTRELA_POR_FRASE * ESTRELA_CHEIA);
    partida.eventos.push(Evento::FraseCompleta);
    if !partida.estrela_ativa && antes < ESTRELA_MINIMA && estrela(partida) >= ESTRELA_MINIMA {
        partida.eventos.push(Evento::EstrelaPronta);
    }
}

/// Marca a nota como acertada no instante `tempo` e aplica pontos, vida, sequência e star power.
/// O bot do app usa direto, sem passar pela janela de acerto.
pub fn acertar(partida: &mut Partida, indice: usize, tempo: f64) {
    let julgamento = julgar(tempo - partida.notas[indice].tempo);
    let nota = &mut partida.notas[indice];
    nota.acertada = true;
    nota.segurando = nota.duracao > 0.0;
    nota.segurou_ate = nota.tempo.max(tempo);
    let frase = nota.frase;
    partida.acertos += 1;
    match julgamento {
        Julgamento::Perfeito => partida.perfeitos += 1,
        Julgamento::Otimo => partida.otimos += 1,
        Julgamento::Bom => partida.bons += 1,
    }
    partida.valor_dos_acertos += julgamento.valor();
    partida.sequencia += 1;
    partida.maior_sequencia = partida.maior_sequencia.max(partida.sequencia);
    partida.pontos_das_notas += PONTOS_POR_NOTA * multiplicador(partida);
    atualizar_pontos(partida);
    partida.vida = (partida.vida + VIDA_POR_ACERTO).min(1.0);
    partida.eventos.push(Evento::Acerto { nota: indice, julgamento });
    if partida.sequencia.is_multiple_of(AVISO_DE_SEQUENCIA) {
        partida.eventos.push(Evento::Sequencia(partida.sequencia));
    }
    contar_frase(partida, frase);
}

fn errar(partida: &mut Partida, indice: usize) {
    let nota = &mut partida.notas[indice];
    nota.perdida = true;
    let frase = nota.frase;
    partida.erros += 1;
    partida.sequencia = 0;
    partida.vida = (partida.vida - VIDA_POR_ERRO).max(0.0);
    if frase >= 0 {
        partida.frases_falhas.insert(frase);
    }
    partida.eventos.push(Evento::Erro { nota: indice });
    if partida.vida > 0.0 || partida.sem_falha {
        return;
    }
    if !partida.modo_fantasma {
        partida.derrota = true;
        partida.eventos.push(Evento::Derrota);
    } else if !partida.fantasma {
        partida.fantasma = true;
        partida.eventos.push(Evento::VirouFantasma);
    }
}

fn atualizar_pontos(partida: &mut Partida) {
    partida.pontos = (partida.pontos_das_notas + (partida.sustain_ponderado * PONTOS_POR_SEGUNDO_DE_SUSTAIN) / TICKS_POR_SEGUNDO) * partida.velocidade;
}

fn pontuar_sustain(partida: &mut Partida, indice: usize, tempo: f64) {
    let nota = &partida.notas[indice];
    let ate = tempo.min(nota.tempo + nota.duracao);
    let ticks = ticks_entre(nota.segurou_ate, ate);
    if ticks <= 0.0 {
        return;
    }
    partida.sustain_ponderado += ticks * multiplicador(partida);
    atualizar_pontos(partida);
    partida.notas[indice].segurou_ate = ate;
}

/// Apertou a tecla da pista no instante `tempo` da música. Devolve se acertou alguma nota.
pub fn tocar(partida: &mut Partida, pista: u8, tempo: f64) -> bool {
    let tempo = trazer_ate(partida, tempo);
    if partida.derrota {
        return false;
    }
    match partida.jeito {
        JeitoDeJogar::Palhetada => {
            partida.apertados.insert(pista);
            false
        }
        JeitoDeJogar::Tapping => acertar_mais_proxima(partida, pista, tempo),
        JeitoDeJogar::Gamepad => {
            if !acertar_mais_proxima(partida, pista, tempo) {
                partida.armadas.remove(&pista);
                return false;
            }
            partida.armadas.insert(pista);
            true
        }
    }
}

/// Na palhetada, toca o acorde mais perto se os trastes apertados forem exatamente os dele.
/// Sem nenhum traste apertado, é a nota aberta que toca.
pub fn palhetar(partida: &mut Partida, tempo: f64) -> bool {
    let tempo = trazer_ate(partida, tempo);
    if partida.derrota || partida.jeito != JeitoDeJogar::Palhetada {
        return false;
    }
    let mut mais_perto: Option<f64> = None;
    for nota in partida.notas.iter().skip(partida.primeira) {
        if nota.tempo >= tempo + JANELA_DE_ACERTO {
            break;
        }
        if nota.acertada || nota.perdida {
            continue;
        }
        let distancia = (nota.tempo - tempo).abs();
        if distancia <= JANELA_DE_ACERTO && mais_perto.is_none_or(|t| distancia < (t - tempo).abs()) {
            mais_perto = Some(nota.tempo);
        }
    }
    let Some(batida) = mais_perto else { return false };
    let acorde: Vec<usize> = (partida.primeira..partida.notas.len())
        .take_while(|&i| partida.notas[i].tempo <= batida)
        .filter(|&i| {
            let nota = &partida.notas[i];
            nota.tempo == batida && !nota.acertada && !nota.perdida
        })
        .collect();
    let pistas: HashSet<u8> = acorde.iter().map(|&i| partida.notas[i].pista).filter(|&p| p != PISTA_ABERTA).collect();
    if pistas != partida.apertados {
        return false;
    }
    for indice in acorde {
        acertar(partida, indice, tempo);
    }
    true
}

fn acertar_mais_proxima(partida: &mut Partida, pista: u8, tempo: f64) -> bool {
    let mut melhor = None;
    let mut menor_distancia = JANELA_DE_ACERTO;
    for (i, nota) in partida.notas.iter().enumerate().skip(partida.primeira) {
        if nota.tempo >= tempo + JANELA_DE_ACERTO {
            break;
        }
        if nota.acertada || nota.perdida || nota.pista != pista {
            continue;
        }
        let distancia = (nota.tempo - tempo).abs();
        if distancia <= menor_distancia {
            melhor = Some(i);
            menor_distancia = distancia;
        }
    }
    match melhor {
        Some(indice) => {
            acertar(partida, indice, tempo);
            true
        }
        None => false,
    }
}

/// Soltou a tecla da pista: larga o sustain dela e, se o aperto acertou, a soltura acerta a próxima nota da pista.
pub fn soltar(partida: &mut Partida, pista: u8, tempo: f64) {
    let tempo = trazer_ate(partida, tempo);
    let armada = partida.armadas.remove(&pista);
    partida.apertados.remove(&pista);
    let mut largou_cedo = false;
    for nota in partida.notas.iter_mut().skip(partida.primeira) {
        if nota.tempo > tempo {
            break;
        }
        if !nota.segurando || nota.pista != pista {
            continue;
        }
        nota.segurando = false;
        if tempo < nota.tempo + nota.duracao - TOLERANCIA_DO_SUSTAIN {
            nota.solta = true;
            largou_cedo = true;
        }
    }
    if armada && !largou_cedo && !partida.derrota {
        acertar_mais_proxima(partida, pista, tempo);
    }
}

pub fn ativar_estrela(partida: &mut Partida) -> bool {
    if partida.estrela_ativa || partida.estrela_em_ticks < ESTRELA_MINIMA * ESTRELA_CHEIA || partida.derrota {
        return false;
    }
    partida.estrela_ativa = true;
    partida.eventos.push(Evento::EstrelaAtivada);
    true
}

/// Avança a partida até o tempo da entrada; ela nunca volta para antes do que já passou.
fn trazer_ate(partida: &mut Partida, tempo: f64) -> f64 {
    let ate = quantizar(tempo).max(partida.tempo.unwrap_or(f64::NEG_INFINITY));
    avancar(partida, ate);
    ate
}

/// Leva sustains e star power de `partida.tempo` até `tempo`, sem nada mudando no meio.
fn assentar(partida: &mut Partida, tempo: f64) {
    let ticks = partida.tempo.map_or(0.0, |de| ticks_entre(de, tempo));
    let mut i = partida.primeira;
    while i < partida.notas.len() && partida.notas[i].tempo <= tempo {
        if partida.notas[i].segurando {
            pontuar_sustain(partida, i, tempo);
            let nota = &mut partida.notas[i];
            if tempo >= nota.tempo + nota.duracao {
                nota.segurando = false;
            }
        }
        i += 1;
    }
    if partida.estrela_ativa && ticks > 0.0 {
        partida.estrela_em_ticks = (partida.estrela_em_ticks - ticks).max(0.0);
    }
    partida.tempo = Some(tempo);
}

/// O próximo acontecimento que muda o multiplicador até `tempo`: uma nota perdida (com o índice) ou o fim do star power.
fn proximo_acontecimento(partida: &Partida, tempo: f64) -> Option<(f64, Option<usize>)> {
    let perdida = partida
        .notas
        .iter()
        .enumerate()
        .skip(partida.primeira)
        .take_while(|(_, n)| n.tempo < tempo)
        .find(|(_, n)| !n.acertada && !n.perdida)
        .map(|(i, _)| i);
    let prazo = perdida.map_or(f64::INFINITY, |i| quantizar(partida.notas[i].tempo + JANELA_DE_ACERTO));
    let fim_da_estrela = match (partida.estrela_ativa, partida.tempo) {
        (true, Some(agora)) => quantizar(agora + partida.estrela_em_ticks / TICKS_POR_SEGUNDO),
        _ => f64::INFINITY,
    };
    if perdida.is_some() && prazo < tempo && prazo <= fim_da_estrela {
        return Some((prazo, perdida));
    }
    if fim_da_estrela <= tempo {
        return Some((fim_da_estrela, None));
    }
    None
}

/// Avança a partida até `tempo`, aplicando cada acontecimento no seu próprio tempo.
pub fn avancar(partida: &mut Partida, tempo: f64) {
    if partida.derrota {
        return;
    }
    let tempo = quantizar(tempo).max(partida.tempo.unwrap_or(f64::NEG_INFINITY));

    while let Some((quando, perdida)) = proximo_acontecimento(partida, tempo) {
        assentar(partida, quando.max(partida.tempo.unwrap_or(quando)));
        match perdida {
            Some(indice) => errar(partida, indice),
            None => {
                partida.estrela_em_ticks = 0.0;
                partida.estrela_ativa = false;
            }
        }
        if partida.derrota {
            return;
        }
    }
    assentar(partida, tempo);

    while let Some(nota) = partida.notas.get(partida.primeira) {
        if nota.segurando || nota.tempo + nota.duracao >= tempo - 0.3 {
            break;
        }
        partida.primeira += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nota(tempo: f64) -> Nota {
        Nota {
            tempo,
            pista: 0,
            frase: -1,
            duracao: 0.0,
        }
    }

    #[test]
    fn otimo_vale_dois_tercos_e_bom_um_terco_do_perfeito() {
        let valores = [Julgamento::Perfeito, Julgamento::Otimo, Julgamento::Bom].map(Julgamento::valor);
        assert_eq!(valores, [300, 200, 100]);
    }

    #[test]
    fn sem_aberta_a_nota_aberta_vira_verde_e_sai_com_o_traste_verde() {
        let aberta = Nota {
            tempo: 1.0,
            pista: PISTA_ABERTA,
            frase: 3,
            duracao: 0.5,
        };
        let notas = [aberta, Nota { pista: 2, ..nota(2.0) }];
        let opcoes = OpcoesDaPartida {
            sem_aberta: true,
            ..OpcoesDaPartida::default()
        };
        let mut partida = criar_partida(&notas, opcoes);
        assert_eq!(partida.notas.iter().map(|n| n.pista).collect::<Vec<_>>(), [0, 2]);
        assert_eq!((partida.notas[0].frase, partida.notas[0].duracao), (3, 0.5));
        assert!(!tocar(&mut partida, PISTA_ABERTA, 1.0));
        assert!(tocar(&mut partida, 0, 1.0));
    }

    #[test]
    fn com_a_aberta_ligada_nada_muda() {
        let aberta = Nota {
            pista: PISTA_ABERTA,
            ..nota(1.0)
        };
        let partida = criar_partida(&[aberta], OpcoesDaPartida::default());
        assert_eq!(partida.notas[0].pista, PISTA_ABERTA);
    }

    #[test]
    fn julga_pela_distancia_ate_a_batida() {
        assert_eq!(julgar(0.035), Julgamento::Perfeito);
        assert_eq!(julgar(-0.036), Julgamento::Otimo);
        assert_eq!(julgar(0.07), Julgamento::Otimo);
        assert_eq!(julgar(-0.11), Julgamento::Bom);
    }

    #[test]
    fn arredonda_o_meio_como_o_javascript() {
        assert_eq!(arredondar(-2.5), -2.0);
        assert_eq!(arredondar(2.5), 3.0);
    }

    #[test]
    fn a_nota_perdida_vale_zero_na_precisao() {
        let mut partida = criar_partida(&[nota(1.0), nota(2.0)], OpcoesDaPartida::default());
        assert!(tocar(&mut partida, 0, 1.05));
        avancar(&mut partida, 3.0);
        assert_eq!((partida.otimos, partida.erros), (1, 1));
        assert!((precisao(&partida) - 200.0 / 600.0).abs() < 1e-9);
    }

    #[test]
    fn conta_os_eventos_para_o_app() {
        let mut partida = criar_partida(&[nota(1.0), nota(2.0)], OpcoesDaPartida::default());
        tocar(&mut partida, 0, 1.05);
        avancar(&mut partida, 3.0);
        assert_eq!(
            retirar_eventos(&mut partida),
            [
                Evento::Acerto {
                    nota: 0,
                    julgamento: Julgamento::Otimo
                },
                Evento::Erro { nota: 1 }
            ]
        );
        assert!(retirar_eventos(&mut partida).is_empty());
    }

    #[test]
    fn a_velocidade_traz_as_notas_para_o_tempo_real_e_multiplica_os_pontos() {
        let rapida = OpcoesDaPartida {
            velocidade: 1.5,
            ..OpcoesDaPartida::default()
        };
        let mut partida = criar_partida(&[nota(3.0)], rapida);
        assert_eq!(partida.notas[0].tempo, 2.0);
        assert!(tocar(&mut partida, 0, 2.0));
        assert_eq!(partida.pontos, 75.0);

        let lenta = OpcoesDaPartida {
            velocidade: 0.5,
            ..OpcoesDaPartida::default()
        };
        let mut partida = criar_partida(&[nota(1.0)], lenta);
        assert!(tocar(&mut partida, 0, 2.0));
        assert_eq!(partida.pontos, 25.0);
    }

    #[test]
    fn nao_acerta_fora_da_janela_nem_outra_pista() {
        let mut partida = criar_partida(&[nota(1.0)], OpcoesDaPartida::default());
        assert!(!tocar(&mut partida, 0, 0.8));
        assert!(!tocar(&mut partida, 1, 1.0));
        assert!(tocar(&mut partida, 0, 1.0));
    }

    fn com_jeito(jeito: JeitoDeJogar) -> OpcoesDaPartida {
        OpcoesDaPartida {
            jeito,
            ..OpcoesDaPartida::default()
        }
    }

    fn na_pista(tempo: f64, pista: u8) -> Nota {
        Nota { pista, ..nota(tempo) }
    }

    #[test]
    fn no_gamepad_soltar_a_tecla_acerta_a_proxima_nota_da_pista() {
        let mut partida = criar_partida(&[nota(1.0), nota(1.2)], com_jeito(JeitoDeJogar::Gamepad));
        assert!(tocar(&mut partida, 0, 1.0));
        soltar(&mut partida, 0, 1.2);
        assert_eq!(partida.acertos, 2);
    }

    #[test]
    fn no_tapping_cada_aperto_vale_uma_nota_e_soltar_nao_acerta() {
        let mut partida = criar_partida(&[nota(1.0), nota(1.2)], com_jeito(JeitoDeJogar::Tapping));
        assert!(tocar(&mut partida, 0, 1.0));
        soltar(&mut partida, 0, 1.2);
        assert_eq!(partida.acertos, 1);
        assert!(tocar(&mut partida, 0, 1.2));
        assert_eq!(partida.acertos, 2);
    }

    #[test]
    fn na_palhetada_o_traste_so_acende_e_a_palheta_toca_o_acorde() {
        let mut partida = criar_partida(&[na_pista(1.0, 0), na_pista(1.0, 1)], com_jeito(JeitoDeJogar::Palhetada));
        assert!(!tocar(&mut partida, 0, 0.95));
        assert!(!tocar(&mut partida, 1, 0.96));
        assert_eq!(partida.acertos, 0);
        assert!(palhetar(&mut partida, 1.0));
        assert_eq!(partida.acertos, 2);
    }

    #[test]
    fn na_palhetada_o_acorde_errado_nao_acerta_nada() {
        let mut partida = criar_partida(&[na_pista(1.0, 0), na_pista(1.0, 1)], com_jeito(JeitoDeJogar::Palhetada));
        tocar(&mut partida, 0, 0.95);
        assert!(!palhetar(&mut partida, 1.0));
        tocar(&mut partida, 2, 0.97);
        tocar(&mut partida, 1, 0.98);
        assert!(!palhetar(&mut partida, 1.0));
        assert_eq!(partida.acertos, 0);
    }

    #[test]
    fn na_palhetada_soltar_o_traste_apaga_ele_e_sem_traste_a_palheta_toca_a_aberta() {
        let mut partida = criar_partida(&[na_pista(1.0, 0), na_pista(1.5, PISTA_ABERTA)], com_jeito(JeitoDeJogar::Palhetada));
        tocar(&mut partida, 0, 0.9);
        assert!(palhetar(&mut partida, 1.0));
        soltar(&mut partida, 0, 1.2);
        assert!(palhetar(&mut partida, 1.5));
        assert_eq!(partida.acertos, 2);
    }

    #[test]
    fn fora_da_palhetada_a_palheta_nao_faz_nada() {
        let mut partida = criar_partida(&[nota(1.0)], com_jeito(JeitoDeJogar::Gamepad));
        assert!(!palhetar(&mut partida, 1.0));
        assert_eq!(partida.acertos, 0);
    }
}
