//! As regras da partida, no padrão do Clone Hero. Como o código dele é fechado, os números vêm do manual do
//! Clone Hero e, nos detalhes, do motor de 5 trastes do YARG (YARG.Core), que copia o Clone Hero.

use std::collections::{HashMap, HashSet};

/// Até onde, em segundos de cada lado da batida, o toque acerta a nota (220 ms no total).
pub const JANELA_DE_ACERTO: f64 = 0.11;
/// Faixas de cada julgamento, as do osu!mania com OD 8; o 50 vai até a janela de acerto.
const JANELA_DO_MAX: f64 = 0.016;
const JANELA_DO_300: f64 = 0.04;
const JANELA_DO_200: f64 = 0.073;
const JANELA_DO_100: f64 = 0.103;
/// Depois de palhetar, quanto tempo os trastes ainda podem chegar ao acorde antes de virar palhetada em vão.
const FOLGA_DA_PALHETADA: f64 = 0.05;
/// Depois de acertar um HOPO ou tap, uma palhetada logo em seguida é engolida, sem punir.
const FOLGA_DO_HOPO: f64 = 0.08;
/// Até quanto antes da nota uma troca de trastes ainda vale para o HOPO ou tap que chega depois dela.
const FRENTE_DA_TROCA: f64 = 0.08;
const VIDA_INICIAL: f64 = 0.5;
const VIDA_POR_ACERTO: f64 = 0.02;
const VIDA_POR_ERRO: f64 = 0.03;
const PONTOS_POR_NOTA: f64 = 50.0;
/// O sustain rende 25 pontos por batida segurada, vezes o multiplicador.
const PONTOS_POR_BATIDA_DE_SUSTAIN: f64 = 25.0;
/// Bônus de solo do YARG: 100 por nota, a partir de 60% das notas do solo, até o cheio em 100%.
const BONUS_POR_NOTA_DE_SOLO: f64 = 100.0;
const SOLO_MINIMO: f64 = 0.6;
/// A barra de star power cheia vale 8 compassos; cada frase completa enche 2.
const COMPASSOS_DA_BARRA: f64 = 8.0;
const COMPASSOS_POR_FRASE: f64 = 2.0;
const ESTRELA_MINIMA: f64 = 0.5;
/// A cada tantas notas seguidas o app comemora a sequência.
const AVISO_DE_SEQUENCIA: u32 = 50;
const TOLERANCIA_DO_SUSTAIN: f64 = 0.1;
const TICKS_POR_SEGUNDO: f64 = 1000.0;
pub const PISTA_ABERTA: u8 = 5;

/// O `Math.round` do JavaScript: o meio vai para cima também nos negativos, ao contrário do `f64::round`.
fn arredondar(x: f64) -> f64 {
    (x + 0.5).floor()
}

/// O toque a `distancia` segundos da nota cai na janela? Compara em ticks, para 110 ms ser 110 ms.
fn na_janela(distancia: f64) -> bool {
    arredondar(distancia.abs() * TICKS_POR_SEGUNDO) <= JANELA_DE_ACERTO * TICKS_POR_SEGUNDO
}

pub fn quantizar(tempo: f64) -> f64 {
    arredondar(tempo * TICKS_POR_SEGUNDO) / TICKS_POR_SEGUNDO
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Julgamento {
    Max,
    J300,
    J200,
    J100,
    J50,
}

/// Na ordem da `contagem` da partida.
pub const JULGAMENTOS: [Julgamento; 5] = [Julgamento::Max, Julgamento::J300, Julgamento::J200, Julgamento::J100, Julgamento::J50];

impl Julgamento {
    /// Quanto o acerto vale na precisão, como no ScoreV1 do osu!mania: o MAX vale o mesmo que o 300.
    pub fn valor(self) -> u32 {
        match self {
            Self::Max | Self::J300 => 300,
            Self::J200 => 200,
            Self::J100 => 100,
            Self::J50 => 50,
        }
    }

    /// A posição na `contagem` da partida.
    pub fn indice(self) -> usize {
        self as usize
    }
}

/// O julgamento de um toque a `distancia` segundos da batida, para qualquer lado. Compara em ticks.
pub fn julgar(distancia: f64) -> Julgamento {
    let ticks = arredondar(distancia * TICKS_POR_SEGUNDO).abs();
    let faixas = [
        (JANELA_DO_MAX, Julgamento::Max),
        (JANELA_DO_300, Julgamento::J300),
        (JANELA_DO_200, Julgamento::J200),
        (JANELA_DO_100, Julgamento::J100),
    ];
    faixas
        .into_iter()
        .find(|(janela, _)| ticks <= arredondar(janela * TICKS_POR_SEGUNDO))
        .map_or(Julgamento::J50, |(_, julgamento)| julgamento)
}

/// Como a nota se toca, como no Clone Hero.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TipoDaNota {
    /// Precisa da palheta.
    #[default]
    Strum,
    /// Hammer-on/pull-off: com a sequência ativa, só o traste toca.
    Hopo,
    /// Só o traste toca, mesmo sem sequência.
    Tap,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Nota {
    pub tempo: f64,
    pub pista: u8,
    /// Notas da mesma frase de star power têm o mesmo id; -1 é nota comum.
    pub frase: i32,
    pub duracao: f64,
    pub tipo: TipoDaNota,
    /// Notas do mesmo solo têm o mesmo id; -1 é fora de solo.
    pub solo: i32,
}

impl Nota {
    /// Uma nota comum, sem frase, sustain, tipo ou solo.
    pub fn simples(tempo: f64, pista: u8) -> Self {
        Self {
            tempo,
            pista,
            frase: -1,
            duracao: 0.0,
            tipo: TipoDaNota::Strum,
            solo: -1,
        }
    }
}

/// As batidas e os compassos da música, em segundos da música. Medem o sustain (por batida) e o star power (por compasso).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Ritmo {
    pub batidas: Vec<f64>,
    pub compassos: Vec<f64>,
}

/// Quantas marcas da grade (batidas ou compassos) passaram até `tempo`, com fração. Fora da grade, segue o último passo
/// (ou 0,5 s, que é uma batida a 120 BPM, sem grade nenhuma).
fn posicao_na_grade(grade: &[f64], passo_padrao: f64, tempo: f64) -> f64 {
    let passo = |i: usize| grade.get(i + 1).zip(grade.get(i)).map_or(passo_padrao, |(b, a)| (b - a).max(1e-6));
    let Some(&primeira) = grade.first() else { return tempo / passo_padrao };
    if tempo <= primeira {
        return (tempo - primeira) / passo(0);
    }
    let i = grade.partition_point(|&t| t <= tempo) - 1;
    let ultimo = grade.len() - 1;
    let passo_aqui = if i >= ultimo {
        if ultimo > 0 {
            passo(ultimo - 1)
        } else {
            passo_padrao
        }
    } else {
        passo(i)
    };
    i as f64 + (tempo - grade[i]) / passo_aqui
}

#[derive(Debug, Clone)]
pub struct NotaEmJogo {
    pub tempo: f64,
    pub pista: u8,
    pub frase: i32,
    pub duracao: f64,
    pub tipo: TipoDaNota,
    pub solo: i32,
    pub acertada: bool,
    pub perdida: bool,
    pub segurando: bool,
    /// Sustain largado antes do fim.
    pub solta: bool,
    /// Até onde o sustain já rendeu pontos.
    pub segurou_ate: f64,
    /// O sustain de um acorde rende uma vez só: as outras notas do acorde com o mesmo fim não pontuam.
    pontua_sustain: bool,
    /// Apertou um traste errado acima dela enquanto esperava: o HOPO não sai mais só no traste, precisa da palheta.
    fantasmada: bool,
}

/// Como as teclas viram notas.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum JeitoDeJogar {
    /// Cada aperto acerta uma nota, e só uma. Soltar não toca nada.
    Tapping,
    /// Soltar a tecla depois de um acerto também acerta a próxima nota da pista, e o pull-off para o traste segurado.
    #[default]
    Gamepad,
    /// Como a guitarra do Clone Hero: trastes, palheta, HOPO, tap e âncora.
    Palhetada,
}

#[derive(Debug, Clone, Copy)]
pub struct OpcoesDaPartida {
    pub sem_falha: bool,
    /// Multijogador: a vida zerada não tira da música, só deixa a marca de fantasma.
    pub fantasma: bool,
    /// Velocidade da música (1 é a normal). As notas vêm no tempo da música e a partida roda no tempo real:
    /// com a música a 1,5x, uma nota no segundo 3 da música chega no segundo 2. Como no Clone Hero, ela não mexe
    /// nos pontos: o ranking separa as partidas por velocidade.
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
    /// Um toque que não acertou nada. `pista` é o traste; na palheta, `None`.
    ToqueEmVazio {
        pista: Option<u8>,
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
    /// Milésimos de batida de sustain segurados, cada um vezes o multiplicador da hora.
    sustain_ponderado: f64,
    /// O bônus dos solos já fechados.
    pub bonus_de_solo: f64,
    /// Acordes seguidos sem errar (o acorde conta 1, como no Clone Hero).
    pub sequencia: u32,
    pub maior_sequencia: u32,
    pub acertos: u32,
    /// Quantos acertos de cada julgamento, de MAX a 50. As notas perdidas (o Miss) ficam em `erros`.
    pub contagem: [u32; 5],
    /// Soma do valor de cada acerto, para a precisão.
    pub valor_dos_acertos: u32,
    /// Notas que passaram sem ser tocadas.
    pub erros: u32,
    /// Palhetadas e toques que não acertaram nada. Qualquer um tira o full combo.
    pub toques_em_vazio: u32,
    pub vida: f64,
    /// Quantos compassos de star power a barra guarda (de 0 a 8). Derivado de `estrela_em_milesimos`.
    pub estrela_em_compassos: f64,
    estrela_em_milesimos: f64,
    pub estrela_ativa: bool,
    pub derrota: bool,
    sem_falha: bool,
    modo_fantasma: bool,
    /// A vida zerou em algum momento.
    pub fantasma: bool,
    tamanho_das_frases: HashMap<i32, u32>,
    acertos_por_frase: HashMap<i32, u32>,
    pub frases_falhas: HashSet<i32>,
    tamanho_dos_solos: HashMap<i32, u32>,
    acertos_por_solo: HashMap<i32, u32>,
    solos_fechados: HashSet<i32>,
    /// Batidas e compassos já no tempo real.
    batidas: Vec<f64>,
    compassos: Vec<f64>,
    /// Pistas cujo último aperto acertou uma nota: soltar a tecla pode acertar mais uma.
    armadas: HashSet<u8>,
    jeito: JeitoDeJogar,
    /// Na palhetada, os trastes que estão apertados agora.
    apertados: HashSet<u8>,
    /// A palhetada que ainda espera os trastes chegarem ao acorde, até a folga acabar.
    palhetada_pendente: Option<f64>,
    /// Até quando uma palhetada é engolida, depois de um HOPO ou tap acertado só no traste.
    engole_palhetada_ate: f64,
    /// Quando os trastes mudaram pela última vez sem que uma nota usasse a troca. Como no Clone Hero e no YARG,
    /// o HOPO ou tap que entra na janela com os trastes já certos sai sozinho, se a troca veio a tempo.
    troca_pendente: Option<f64>,
    eventos: Vec<Evento>,
}

pub fn criar_partida(notas: &[Nota], opcoes: OpcoesDaPartida) -> Partida {
    criar_partida_com_ritmo(notas, &Ritmo::default(), opcoes)
}

pub fn criar_partida_com_ritmo(notas: &[Nota], ritmo: &Ritmo, opcoes: OpcoesDaPartida) -> Partida {
    let contar = |id: fn(&Nota) -> i32| {
        let mut tamanho = HashMap::new();
        for nota in notas.iter().filter(|n| id(n) >= 0) {
            *tamanho.entry(id(nota)).or_insert(0) += 1;
        }
        tamanho
    };
    let no_tempo_real = |grade: &[f64]| grade.iter().map(|t| t / opcoes.velocidade).collect::<Vec<_>>();
    let mut em_jogo: Vec<NotaEmJogo> = notas
        .iter()
        .map(|n| {
            let tempo = quantizar(n.tempo / opcoes.velocidade);
            NotaEmJogo {
                tempo,
                pista: if opcoes.sem_aberta && n.pista == PISTA_ABERTA { 0 } else { n.pista },
                frase: n.frase,
                duracao: quantizar((n.tempo + n.duracao) / opcoes.velocidade) - tempo,
                tipo: n.tipo,
                solo: n.solo,
                acertada: false,
                perdida: false,
                segurando: false,
                solta: false,
                segurou_ate: tempo,
                pontua_sustain: true,
                fantasmada: false,
            }
        })
        .collect();
    // Sustain de acorde (mesmo começo e mesmo fim) rende uma vez; o estendido e o disjunto rendem por nota.
    for i in 1..em_jogo.len() {
        let mesmo_acorde = (0..i)
            .rev()
            .take_while(|&j| em_jogo[j].tempo == em_jogo[i].tempo)
            .any(|j| em_jogo[j].duracao == em_jogo[i].duracao);
        if mesmo_acorde && em_jogo[i].duracao > 0.0 {
            em_jogo[i].pontua_sustain = false;
        }
    }
    Partida {
        notas: em_jogo,
        primeira: 0,
        tempo: None,
        pontos: 0.0,
        pontos_das_notas: 0.0,
        sustain_ponderado: 0.0,
        bonus_de_solo: 0.0,
        sequencia: 0,
        maior_sequencia: 0,
        acertos: 0,
        contagem: [0; 5],
        valor_dos_acertos: 0,
        erros: 0,
        toques_em_vazio: 0,
        vida: VIDA_INICIAL,
        estrela_em_compassos: 0.0,
        estrela_em_milesimos: 0.0,
        estrela_ativa: false,
        derrota: false,
        sem_falha: opcoes.sem_falha,
        modo_fantasma: opcoes.fantasma,
        fantasma: false,
        tamanho_das_frases: contar(|n| n.frase),
        acertos_por_frase: HashMap::new(),
        frases_falhas: HashSet::new(),
        tamanho_dos_solos: contar(|n| n.solo),
        acertos_por_solo: HashMap::new(),
        solos_fechados: HashSet::new(),
        batidas: no_tempo_real(&ritmo.batidas),
        compassos: no_tempo_real(&ritmo.compassos),
        armadas: HashSet::new(),
        jeito: opcoes.jeito,
        apertados: HashSet::new(),
        palhetada_pendente: None,
        engole_palhetada_ate: f64::NEG_INFINITY,
        troca_pendente: None,
        eventos: Vec::new(),
    }
}

/// Milésimos de batida e de compasso até o tempo real, inteiros: somar os pedaços dá sempre o mesmo total, não
/// importa em quantos quadros a partida avançou.
const MILESIMOS: f64 = 1000.0;

fn batida_em(partida: &Partida, tempo: f64) -> f64 {
    arredondar(posicao_na_grade(&partida.batidas, 0.5, tempo) * MILESIMOS)
}

fn compasso_em(partida: &Partida, tempo: f64) -> f64 {
    arredondar(posicao_na_grade(&partida.compassos, 2.0, tempo) * MILESIMOS)
}

/// 1x a 4x a cada 10 acordes seguidos; o star power dobra.
pub fn multiplicador(partida: &Partida) -> f64 {
    let base = (1 + partida.sequencia / 10).min(4);
    f64::from(base * if partida.estrela_ativa { 2 } else { 1 })
}

/// O valor dos acertos sobre o máximo das notas que já passaram (0 a 1): MAX ou 300 em todas dá 100%.
pub fn precisao(partida: &Partida) -> f64 {
    let tocadas = partida.acertos + partida.erros;
    if tocadas == 0 {
        return 1.0;
    }
    f64::from(partida.valor_dos_acertos) / (f64::from(tocadas) * f64::from(Julgamento::Max.valor()))
}

/// Full combo: todas as notas acertadas sem nenhuma palhetada ou toque em vão.
pub fn full_combo(partida: &Partida) -> bool {
    partida.erros == 0 && partida.toques_em_vazio == 0 && partida.acertos as usize == partida.notas.len()
}

/// Os eventos acumulados desde a última chamada.
pub fn retirar_eventos(partida: &mut Partida) -> Vec<Evento> {
    std::mem::take(&mut partida.eventos)
}

/// De 0 a 1: quanto da barra de star power está cheia.
pub fn estrela(partida: &Partida) -> f64 {
    partida.estrela_em_compassos / COMPASSOS_DA_BARRA
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
    mudar_estrela(
        partida,
        (partida.estrela_em_milesimos + COMPASSOS_POR_FRASE * MILESIMOS).min(COMPASSOS_DA_BARRA * MILESIMOS),
    );
    partida.eventos.push(Evento::FraseCompleta);
    if !partida.estrela_ativa && antes < ESTRELA_MINIMA && estrela(partida) >= ESTRELA_MINIMA {
        partida.eventos.push(Evento::EstrelaPronta);
    }
}

/// O bônus do solo, quando a última nota dele passa: 100 por nota acertada, de 60% em diante, arredondado em 50.
fn fechar_solo(partida: &mut Partida, solo: i32) {
    let tamanho = partida.tamanho_dos_solos.get(&solo).copied().unwrap_or(0);
    if solo < 0 || tamanho == 0 || partida.solos_fechados.contains(&solo) {
        return;
    }
    let ultima = partida.notas.iter().rposition(|n| n.solo == solo);
    if !ultima.is_some_and(|i| partida.notas[i].acertada || partida.notas[i].perdida) {
        return;
    }
    partida.solos_fechados.insert(solo);
    let acertos = f64::from(partida.acertos_por_solo.get(&solo).copied().unwrap_or(0));
    let fracao = acertos / f64::from(tamanho);
    let escala = ((fracao - SOLO_MINIMO) / (1.0 - SOLO_MINIMO)).clamp(0.0, 1.0);
    partida.bonus_de_solo += ((BONUS_POR_NOTA_DE_SOLO * acertos * escala) / 50.0).floor() * 50.0;
    atualizar_pontos(partida);
}

/// Marca a nota como acertada no instante `tempo` e aplica pontos, vida e star power. A sequência sobe por acorde:
/// quem chama acerta as notas do acorde juntas e chama `contar_acorde` uma vez. O bot do app usa direto.
pub fn acertar(partida: &mut Partida, indice: usize, tempo: f64) {
    if partida.notas[indice].acertada || partida.notas[indice].perdida {
        return;
    }
    partida.troca_pendente = None;
    let mesmo_acorde = partida
        .notas
        .iter()
        .enumerate()
        .any(|(i, n)| i != indice && n.acertada && n.tempo == partida.notas[indice].tempo);
    if !mesmo_acorde {
        contar_acorde(partida);
    }
    let julgamento = julgar(tempo - partida.notas[indice].tempo);
    let nota = &mut partida.notas[indice];
    nota.acertada = true;
    nota.segurando = nota.duracao > 0.0;
    nota.segurou_ate = nota.tempo.max(tempo);
    let (frase, solo) = (nota.frase, nota.solo);
    partida.acertos += 1;
    partida.contagem[julgamento.indice()] += 1;
    partida.valor_dos_acertos += julgamento.valor();
    partida.pontos_das_notas += PONTOS_POR_NOTA * multiplicador(partida);
    atualizar_pontos(partida);
    partida.vida = (partida.vida + VIDA_POR_ACERTO).min(1.0);
    partida.eventos.push(Evento::Acerto { nota: indice, julgamento });
    contar_frase(partida, frase);
    if solo >= 0 {
        *partida.acertos_por_solo.entry(solo).or_insert(0) += 1;
        fechar_solo(partida, solo);
    }
}

/// Um acorde (ou nota simples) acertado: a sequência sobe 1.
fn contar_acorde(partida: &mut Partida) {
    partida.sequencia += 1;
    partida.maior_sequencia = partida.maior_sequencia.max(partida.sequencia);
    if partida.sequencia.is_multiple_of(AVISO_DE_SEQUENCIA) {
        partida.eventos.push(Evento::Sequencia(partida.sequencia));
    }
}

/// Quebrar a sequência também cancela a frase de star power em andamento, como no Clone Hero.
fn quebrar_sequencia(partida: &mut Partida) {
    partida.sequencia = 0;
    let em_andamento = partida
        .notas
        .iter()
        .skip(partida.primeira)
        .find(|n| !n.acertada && !n.perdida)
        .map(|n| n.frase)
        .filter(|&f| f >= 0);
    let ja_comecada = partida.notas.iter().rev().find(|n| n.acertada).map(|n| n.frase).filter(|&f| f >= 0);
    for frase in [em_andamento, ja_comecada].into_iter().flatten() {
        if partida.acertos_por_frase.get(&frase).copied().unwrap_or(0) < partida.tamanho_das_frases.get(&frase).copied().unwrap_or(0) {
            partida.frases_falhas.insert(frase);
        }
    }
}

fn errar(partida: &mut Partida, indice: usize) {
    partida.troca_pendente = None;
    let nota = &mut partida.notas[indice];
    nota.perdida = true;
    let (frase, solo) = (nota.frase, nota.solo);
    partida.erros += 1;
    quebrar_sequencia(partida);
    partida.vida = (partida.vida - VIDA_POR_ERRO).max(0.0);
    if frase >= 0 {
        partida.frases_falhas.insert(frase);
    }
    partida.eventos.push(Evento::Erro { nota: indice });
    fechar_solo(partida, solo);
    perder_vida(partida);
}

/// O toque não acertou nota nenhuma: perde a sequência, a frase em andamento e a vida de um erro, mas nenhuma nota
/// conta como perdida. Tira o full combo.
fn tocar_em_vazio(partida: &mut Partida, pista: Option<u8>) {
    partida.toques_em_vazio += 1;
    quebrar_sequencia(partida);
    partida.vida = (partida.vida - VIDA_POR_ERRO).max(0.0);
    partida.eventos.push(Evento::ToqueEmVazio { pista });
    perder_vida(partida);
}

/// Depois de a vida cair: com ela zerada, a partida acaba (ou vira fantasma no multijogador).
fn perder_vida(partida: &mut Partida) {
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

fn mudar_estrela(partida: &mut Partida, milesimos: f64) {
    partida.estrela_em_milesimos = milesimos;
    partida.estrela_em_compassos = milesimos / MILESIMOS;
}

fn atualizar_pontos(partida: &mut Partida) {
    partida.pontos = partida.pontos_das_notas + partida.sustain_ponderado * PONTOS_POR_BATIDA_DE_SUSTAIN / MILESIMOS + partida.bonus_de_solo;
}

fn pontuar_sustain(partida: &mut Partida, indice: usize, tempo: f64) {
    let nota = &partida.notas[indice];
    let ate = tempo.min(nota.tempo + nota.duracao);
    if ate <= nota.segurou_ate {
        return;
    }
    if nota.pontua_sustain {
        let milesimos = batida_em(partida, ate) - batida_em(partida, nota.segurou_ate);
        partida.sustain_ponderado += milesimos * multiplicador(partida);
        atualizar_pontos(partida);
    }
    partida.notas[indice].segurou_ate = ate;
}

/// Apertou a tecla da pista no instante `tempo` da música. Devolve se acertou alguma nota.
pub fn tocar(partida: &mut Partida, pista: u8, tempo: f64) -> bool {
    let tempo = trazer_ate(partida, tempo);
    if partida.derrota {
        return false;
    }
    // A nota aberta tem tecla própria no gamepad e no tapping: ela não conta como traste apertado.
    if pista != PISTA_ABERTA {
        partida.apertados.insert(pista);
    }
    partida.troca_pendente = Some(tempo);
    match partida.jeito {
        JeitoDeJogar::Palhetada => mudou_os_trastes(partida, tempo, Some(pista)),
        JeitoDeJogar::Tapping => {
            let acertou = acertar_mais_proxima(partida, pista, tempo);
            if !acertou && !acabou_de_acertar(partida, pista, tempo) {
                tocar_em_vazio(partida, Some(pista));
            }
            acertou
        }
        JeitoDeJogar::Gamepad => {
            if !acertar_mais_proxima(partida, pista, tempo) {
                partida.armadas.remove(&pista);
                if !acabou_de_acertar(partida, pista, tempo) {
                    tocar_em_vazio(partida, Some(pista));
                }
                return false;
            }
            partida.armadas.insert(pista);
            true
        }
    }
}

/// O próximo acorde ainda por tocar na janela de `tempo`: os índices das notas dele.
fn proximo_acorde(partida: &Partida, tempo: f64) -> Option<Vec<usize>> {
    let inicio = (partida.primeira..partida.notas.len()).find(|&i| {
        let n = &partida.notas[i];
        !n.acertada && !n.perdida && (n.tempo >= tempo || na_janela(n.tempo - tempo))
    })?;
    let batida = partida.notas[inicio].tempo;
    if !na_janela(batida - tempo) {
        return None;
    }
    Some(
        (inicio..partida.notas.len())
            .take_while(|&i| partida.notas[i].tempo == batida)
            .filter(|&i| !partida.notas[i].acertada && !partida.notas[i].perdida)
            .collect(),
    )
}

/// Os trastes apertados tocam o acorde? Como no Clone Hero: a nota simples aceita trastes mais baixos segurados (âncora);
/// o acorde palhetado exige os trastes exatos; o acorde HOPO ou tap aceita âncora abaixo do traste mais baixo dele.
/// A nota aberta exige nenhum traste.
fn trastes_tocam(partida: &Partida, acorde: &[usize]) -> bool {
    let pistas: HashSet<u8> = acorde.iter().map(|&i| partida.notas[i].pista).collect();
    let apertados = &partida.apertados;
    if pistas.contains(&PISTA_ABERTA) {
        return apertados.is_empty();
    }
    let mais_baixa = pistas.iter().copied().min().unwrap_or(0);
    let mais_alta = pistas.iter().copied().max().unwrap_or(0);
    if !pistas.is_subset(apertados) || apertados.iter().any(|&p| p > mais_alta) {
        return false;
    }
    let extras_abaixo = apertados.iter().all(|&p| pistas.contains(&p) || p < mais_baixa);
    let solta = acorde.iter().all(|&i| partida.notas[i].tipo != TipoDaNota::Strum);
    if pistas.len() == 1 || solta {
        extras_abaixo
    } else {
        *apertados == pistas
    }
}

/// Pode sair só no traste: tap sempre; HOPO com a sequência ativa e sem ter sido "fantasmado".
fn sai_sem_palheta(partida: &Partida, acorde: &[usize]) -> bool {
    acorde.iter().all(|&i| {
        let n = &partida.notas[i];
        match n.tipo {
            TipoDaNota::Tap => true,
            TipoDaNota::Hopo => partida.sequencia > 0 && !n.fantasmada,
            TipoDaNota::Strum => false,
        }
    })
}

fn acertar_acorde(partida: &mut Partida, acorde: &[usize], tempo: f64) {
    for &indice in acorde {
        acertar(partida, indice, tempo);
    }
}

/// Na palhetada, os trastes mudaram: a palhetada pendente pode acertar agora, e o HOPO ou tap sai só no traste.
fn mudou_os_trastes(partida: &mut Partida, tempo: f64, apertou: Option<u8>) -> bool {
    let Some(acorde) = proximo_acorde(partida, tempo) else { return false };
    let tocam = trastes_tocam(partida, &acorde);
    if tocam && partida.palhetada_pendente.is_some() {
        partida.palhetada_pendente = None;
        acertar_acorde(partida, &acorde, tempo);
        return true;
    }
    if tocam && sai_sem_palheta(partida, &acorde) {
        acertar_acorde(partida, &acorde, tempo);
        partida.engole_palhetada_ate = tempo + FOLGA_DO_HOPO;
        return true;
    }
    // Anti-ghosting: um traste errado acima do HOPO esperando faz ele precisar da palheta.
    if let Some(pista) = apertou {
        let mais_alta = acorde.iter().map(|&i| partida.notas[i].pista).filter(|&p| p != PISTA_ABERTA).max();
        if mais_alta.is_some_and(|alta| pista > alta) || mais_alta.is_none() {
            for &i in &acorde {
                if partida.notas[i].tipo == TipoDaNota::Hopo {
                    partida.notas[i].fantasmada = true;
                }
            }
        }
    }
    false
}

/// Na palhetada, palheta no instante `tempo`: toca o próximo acorde se os trastes já estão nele; senão espera a folga.
pub fn palhetar(partida: &mut Partida, tempo: f64) -> bool {
    let tempo = trazer_ate(partida, tempo);
    if partida.derrota || partida.jeito != JeitoDeJogar::Palhetada {
        return false;
    }
    if let Some(acorde) = proximo_acorde(partida, tempo).filter(|a| trastes_tocam(partida, a)) {
        partida.palhetada_pendente = None;
        acertar_acorde(partida, &acorde, tempo);
        return true;
    }
    if tempo <= partida.engole_palhetada_ate {
        partida.engole_palhetada_ate = f64::NEG_INFINITY;
        return false;
    }
    // Duas palhetadas na mesma folga: a primeira foi em vão.
    if partida.palhetada_pendente.take().is_some() {
        tocar_em_vazio(partida, None);
    }
    partida.palhetada_pendente = Some(tempo);
    false
}

/// Uma nota da pista já acertada na janela do toque: no gamepad a soltura acerta a próxima nota,
/// e o aperto que o jogador dá para ela chega depois e não pode contar como toque em vazio.
fn acabou_de_acertar(partida: &Partida, pista: u8, tempo: f64) -> bool {
    partida
        .notas
        .iter()
        .rev()
        .skip_while(|nota| nota.tempo >= tempo + JANELA_DE_ACERTO)
        .take_while(|nota| nota.tempo > tempo - JANELA_DE_ACERTO)
        .any(|nota| nota.acertada && nota.pista == pista)
}

fn acertar_mais_proxima(partida: &mut Partida, pista: u8, tempo: f64) -> bool {
    let mut melhor = None;
    let mut menor_distancia = f64::INFINITY;
    for (i, nota) in partida.notas.iter().enumerate().skip(partida.primeira) {
        if nota.tempo > tempo && !na_janela(nota.tempo - tempo) {
            break;
        }
        if nota.acertada || nota.perdida || nota.pista != pista || !na_janela(nota.tempo - tempo) {
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
/// Na palhetada, soltar também muda os trastes: pode tocar um pull-off ou a nota aberta HOPO.
pub fn soltar(partida: &mut Partida, pista: u8, tempo: f64) {
    let tempo = trazer_ate(partida, tempo);
    let armada = partida.armadas.remove(&pista);
    partida.apertados.remove(&pista);
    partida.troca_pendente = Some(tempo);
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
    if partida.derrota {
        return;
    }
    if partida.jeito == JeitoDeJogar::Palhetada {
        mudou_os_trastes(partida, tempo, None);
    } else if partida.jeito == JeitoDeJogar::Gamepad && !(armada && !largou_cedo && acertar_mais_proxima(partida, pista, tempo)) {
        pull_off_no_traste_segurado(partida, tempo);
    }
}

/// No gamepad, que no Clone Hero é a guitarra com a palhetada automática: soltar o traste de cima toca o HOPO ou tap do traste que ficou segurado embaixo,
/// como o pull-off da palhetada. A nota aberta tem tecla própria no gamepad e fica de fora.
fn pull_off_no_traste_segurado(partida: &mut Partida, tempo: f64) {
    if partida.apertados.is_empty() {
        return;
    }
    let Some(acorde) = proximo_acorde(partida, tempo) else { return };
    let sem_aberta = acorde.iter().all(|&i| partida.notas[i].pista != PISTA_ABERTA);
    if sem_aberta && trastes_tocam(partida, &acorde) && sai_sem_palheta(partida, &acorde) {
        acertar_acorde(partida, &acorde, tempo);
    }
}

pub fn ativar_estrela(partida: &mut Partida) -> bool {
    if partida.estrela_ativa || estrela(partida) < ESTRELA_MINIMA || partida.derrota {
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
    let compassos = partida.tempo.map_or(0.0, |de| compasso_em(partida, tempo) - compasso_em(partida, de));
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
    if partida.estrela_ativa && compassos > 0.0 {
        mudar_estrela(partida, (partida.estrela_em_milesimos - compassos).max(0.0));
    }
    partida.tempo = Some(tempo);
}

/// O tempo real em que a barra de star power, gastando desde `agora`, acaba.
fn fim_da_estrela(partida: &Partida, agora: f64) -> f64 {
    let alvo = compasso_em(partida, agora) + partida.estrela_em_milesimos;
    let (mut baixo, mut alto) = (agora, agora + 1.0);
    while compasso_em(partida, alto) < alvo {
        alto = agora + (alto - agora) * 2.0;
    }
    for _ in 0..50 {
        let meio = (baixo + alto) / 2.0;
        if compasso_em(partida, meio) < alvo {
            baixo = meio;
        } else {
            alto = meio;
        }
    }
    quantizar(alto)
}

enum Acontecimento {
    Perdida(usize),
    HopoNosTrastes(Vec<usize>),
    FimDaEstrela,
    PalhetadaEmVao,
}

/// O próximo HOPO ou tap que os trastes já apertados tocam: sai quando a janela dele abre (ou na troca, se ela veio
/// depois), desde que a troca de trastes tenha sido no máximo `FRENTE_DA_TROCA` antes da nota. É o que deixa soltar
/// o traste de cima antes da hora no começo de Through the Fire and Flames e ainda pegar o verde segurado.
fn hopo_nos_trastes(partida: &Partida) -> Option<(f64, Acontecimento)> {
    // No tapping cada aperto vale uma nota, e só uma: nada sai sozinho.
    if partida.jeito == JeitoDeJogar::Tapping {
        return None;
    }
    let trocou = partida.troca_pendente?;
    let inicio = (partida.primeira..partida.notas.len()).find(|&i| !partida.notas[i].acertada && !partida.notas[i].perdida)?;
    let batida = partida.notas[inicio].tempo;
    let acorde: Vec<usize> = (inicio..partida.notas.len())
        .take_while(|&i| partida.notas[i].tempo == batida)
        .filter(|&i| !partida.notas[i].acertada && !partida.notas[i].perdida)
        .collect();
    let aberta = acorde.iter().any(|&i| partida.notas[i].pista == PISTA_ABERTA);
    if batida - trocou > FRENTE_DA_TROCA + 1e-9
        || (aberta && partida.jeito != JeitoDeJogar::Palhetada)
        || !sai_sem_palheta(partida, &acorde)
        || !trastes_tocam(partida, &acorde)
    {
        return None;
    }
    let quando = quantizar((batida - JANELA_DE_ACERTO).max(trocou));
    (quando <= quantizar(batida + JANELA_DE_ACERTO)).then_some((quando, Acontecimento::HopoNosTrastes(acorde)))
}

/// O próximo acontecimento até `tempo`: uma nota perdida, o fim do star power ou a folga da palhetada acabando.
fn proximo_acontecimento(partida: &Partida, tempo: f64) -> Option<(f64, Acontecimento)> {
    let perdida = partida
        .notas
        .iter()
        .enumerate()
        .skip(partida.primeira)
        .take_while(|(_, n)| n.tempo < tempo)
        .find(|(_, n)| !n.acertada && !n.perdida)
        .map(|(i, _)| i);
    let mut candidatos: Vec<(f64, Acontecimento)> = Vec::new();
    if let Some(i) = perdida {
        candidatos.push((quantizar(partida.notas[i].tempo + JANELA_DE_ACERTO), Acontecimento::Perdida(i)));
    }
    if let (true, Some(agora)) = (partida.estrela_ativa, partida.tempo) {
        candidatos.push((fim_da_estrela(partida, agora), Acontecimento::FimDaEstrela));
    }
    if let Some(acontecimento) = hopo_nos_trastes(partida) {
        candidatos.push(acontecimento);
    }
    if let Some(palhetou) = partida.palhetada_pendente {
        candidatos.push((quantizar(palhetou + FOLGA_DA_PALHETADA), Acontecimento::PalhetadaEmVao));
    }
    candidatos
        .into_iter()
        // A nota só conta como perdida depois de a janela fechar antes do tempo pedido; o resto vale no próprio tempo.
        .filter(|(quando, acontecimento)| {
            if matches!(acontecimento, Acontecimento::Perdida(_)) {
                *quando < tempo
            } else {
                *quando <= tempo
            }
        })
        .min_by(|a, b| a.0.total_cmp(&b.0))
}

/// Avança a partida até `tempo`, aplicando cada acontecimento no seu próprio tempo.
pub fn avancar(partida: &mut Partida, tempo: f64) {
    if partida.derrota {
        return;
    }
    let tempo = quantizar(tempo).max(partida.tempo.unwrap_or(f64::NEG_INFINITY));

    while let Some((quando, acontecimento)) = proximo_acontecimento(partida, tempo) {
        assentar(partida, quando.max(partida.tempo.unwrap_or(quando)));
        match acontecimento {
            Acontecimento::Perdida(indice) => errar(partida, indice),
            Acontecimento::HopoNosTrastes(acorde) => {
                acertar_acorde(partida, &acorde, quando);
                partida.engole_palhetada_ate = quando + FOLGA_DO_HOPO;
            }
            Acontecimento::FimDaEstrela => {
                mudar_estrela(partida, 0.0);
                partida.estrela_ativa = false;
            }
            Acontecimento::PalhetadaEmVao => {
                partida.palhetada_pendente = None;
                tocar_em_vazio(partida, None);
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
        Nota::simples(tempo, 0)
    }

    fn na_pista(tempo: f64, pista: u8) -> Nota {
        Nota::simples(tempo, pista)
    }

    fn do_tipo(tempo: f64, pista: u8, tipo: TipoDaNota) -> Nota {
        Nota {
            tipo,
            ..Nota::simples(tempo, pista)
        }
    }

    fn com_jeito(jeito: JeitoDeJogar) -> OpcoesDaPartida {
        OpcoesDaPartida {
            jeito,
            ..OpcoesDaPartida::default()
        }
    }

    fn palhetada(notas: &[Nota]) -> Partida {
        criar_partida(notas, com_jeito(JeitoDeJogar::Palhetada))
    }

    #[test]
    fn a_janela_e_de_110_ms_para_cada_lado() {
        let mut partida = criar_partida(&[nota(1.0)], OpcoesDaPartida::default());
        assert!(!tocar(&mut partida, 0, 0.88));
        let mut partida = criar_partida(&[nota(1.0)], OpcoesDaPartida::default());
        assert!(tocar(&mut partida, 0, 1.11));
    }

    #[test]
    fn a_precisao_pesa_cada_acerto_pelo_julgamento() {
        let mut partida = criar_partida(&[nota(1.0), nota(2.0)], OpcoesDaPartida::default());
        assert!(tocar(&mut partida, 0, 1.05));
        avancar(&mut partida, 3.0);
        assert_eq!((partida.acertos, partida.erros), (1, 1));
        assert_eq!(partida.contagem, [0, 0, 1, 0, 0]);
        // Um 200 e uma nota perdida, sobre o máximo de dois 300 (600).
        assert!((precisao(&partida) - 200.0 / 600.0).abs() < 1e-9);
    }

    #[test]
    fn a_velocidade_traz_as_notas_para_o_tempo_real_e_nao_mexe_nos_pontos() {
        let rapida = OpcoesDaPartida {
            velocidade: 1.5,
            ..OpcoesDaPartida::default()
        };
        let mut partida = criar_partida(&[nota(3.0)], rapida);
        assert_eq!(partida.notas[0].tempo, 2.0);
        assert!(tocar(&mut partida, 0, 2.0));
        assert_eq!(partida.pontos, 50.0);
    }

    #[test]
    fn o_acorde_vale_50_por_nota_e_sobe_a_sequencia_uma_vez() {
        let mut partida = palhetada(&[na_pista(1.0, 0), na_pista(1.0, 1), na_pista(1.0, 2)]);
        for p in 0..3 {
            tocar(&mut partida, p, 0.95);
        }
        assert!(palhetar(&mut partida, 1.0));
        assert_eq!((partida.acertos, partida.sequencia, partida.pontos), (3, 1, 150.0));
    }

    #[test]
    fn o_multiplicador_sobe_a_cada_10_acordes() {
        let notas: Vec<Nota> = (0..11).map(|i| nota(1.0 + f64::from(i) * 0.5)).collect();
        let mut partida = criar_partida(&notas, OpcoesDaPartida::default());
        for i in 0..10 {
            tocar(&mut partida, 0, 1.0 + f64::from(i) * 0.5);
        }
        assert_eq!(multiplicador(&partida), 2.0);
        // A sequência sobe antes dos pontos: a 10ª nota já vale 2x.
        assert_eq!(partida.pontos, 9.0 * 50.0 + 100.0);
    }

    #[test]
    fn o_sustain_rende_25_por_batida_e_o_acorde_rende_uma_vez() {
        let ritmo = Ritmo {
            batidas: (0..20).map(|i| f64::from(i) * 0.5).collect(),
            compassos: vec![],
        };
        let longa = |pista| Nota {
            duracao: 1.0,
            ..na_pista(1.0, pista)
        };
        let mut partida = criar_partida_com_ritmo(&[longa(0), longa(1)], &ritmo, com_jeito(JeitoDeJogar::Palhetada));
        tocar(&mut partida, 0, 0.99);
        tocar(&mut partida, 1, 0.99);
        palhetar(&mut partida, 1.0);
        avancar(&mut partida, 2.5);
        // Duas notas de 50 e duas batidas de sustain, uma vez só pelo acorde.
        assert_eq!(partida.pontos, 100.0 + 2.0 * 25.0);
    }

    #[test]
    fn na_nota_simples_vale_segurar_os_trastes_de_baixo() {
        let mut partida = palhetada(&[na_pista(1.0, 2)]);
        tocar(&mut partida, 0, 0.9);
        tocar(&mut partida, 2, 0.95);
        assert!(palhetar(&mut partida, 1.0));
    }

    #[test]
    fn traste_acima_da_nota_nao_toca() {
        let mut partida = palhetada(&[na_pista(1.0, 1)]);
        tocar(&mut partida, 1, 0.9);
        tocar(&mut partida, 3, 0.95);
        assert!(!palhetar(&mut partida, 1.0));
    }

    #[test]
    fn o_acorde_palhetado_exige_os_trastes_exatos() {
        let mut partida = palhetada(&[na_pista(1.0, 1), na_pista(1.0, 2)]);
        for p in [0, 1, 2] {
            tocar(&mut partida, p, 0.9);
        }
        assert!(!palhetar(&mut partida, 1.0));
        assert_eq!(partida.acertos, 0);
    }

    #[test]
    fn o_acorde_hopo_aceita_ancora_abaixo() {
        let notas = [na_pista(0.5, 0), do_tipo(1.0, 2, TipoDaNota::Hopo), do_tipo(1.0, 3, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.45);
        assert!(palhetar(&mut partida, 0.5));
        tocar(&mut partida, 2, 0.98);
        assert!(tocar(&mut partida, 3, 1.0));
        assert_eq!(partida.acertos, 3);
    }

    #[test]
    fn o_hopo_sai_so_no_traste_com_a_sequencia_ativa() {
        let notas = [na_pista(1.0, 0), do_tipo(1.2, 1, TipoDaNota::Hopo), do_tipo(1.4, 2, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.95);
        assert!(palhetar(&mut partida, 1.0));
        // Segurando o verde (âncora), os HOPOs saem só nos trastes.
        assert!(tocar(&mut partida, 1, 1.2));
        assert!(tocar(&mut partida, 2, 1.4));
        assert_eq!(partida.sequencia, 3);
    }

    #[test]
    fn o_pull_off_para_o_verde_segurado_acerta_sem_apertar_o_verde_de_novo() {
        // O começo de Through the Fire and Flames: verde, vermelho, verde, amarelo, verde em HOPO.
        let notas = [
            na_pista(1.0, 0),
            do_tipo(1.2, 1, TipoDaNota::Hopo),
            do_tipo(1.4, 0, TipoDaNota::Hopo),
            do_tipo(1.6, 2, TipoDaNota::Hopo),
            do_tipo(1.8, 0, TipoDaNota::Hopo),
        ];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.95);
        assert!(palhetar(&mut partida, 1.0));
        assert!(tocar(&mut partida, 1, 1.2));
        soltar(&mut partida, 1, 1.4);
        assert!(tocar(&mut partida, 2, 1.6));
        soltar(&mut partida, 2, 1.8);
        assert_eq!((partida.acertos, partida.sequencia, partida.toques_em_vazio), (5, 5, 0));
    }

    /// Through the Fire and Flames em qualquer jeito: o verde segurado e os de cima apertados e soltos.
    fn verde_segurado(jeito: JeitoDeJogar) -> Partida {
        let notas = [
            na_pista(1.0, 0),
            do_tipo(1.075, 1, TipoDaNota::Hopo),
            do_tipo(1.15, 0, TipoDaNota::Hopo),
            do_tipo(1.225, 2, TipoDaNota::Hopo),
            do_tipo(1.3, 0, TipoDaNota::Hopo),
        ];
        let mut partida = criar_partida(&notas, com_jeito(jeito));
        tocar(&mut partida, 0, 1.0);
        if jeito == JeitoDeJogar::Palhetada {
            palhetar(&mut partida, 1.0);
        }
        tocar(&mut partida, 1, 1.075);
        soltar(&mut partida, 1, 1.15);
        tocar(&mut partida, 2, 1.225);
        soltar(&mut partida, 2, 1.3);
        partida
    }

    #[test]
    fn o_pull_off_para_o_traste_segurado_vale_na_palhetada_e_no_gamepad() {
        for jeito in [JeitoDeJogar::Palhetada, JeitoDeJogar::Gamepad] {
            let partida = verde_segurado(jeito);
            assert_eq!((partida.acertos, partida.sequencia, partida.toques_em_vazio), (5, 5, 0), "{jeito:?}");
        }
    }

    #[test]
    fn no_tapping_soltar_nao_toca_o_traste_segurado() {
        // Um aperto, uma nota: os dois verdes depois do primeiro passam.
        let mut partida = verde_segurado(JeitoDeJogar::Tapping);
        avancar(&mut partida, 2.0);
        assert_eq!((partida.acertos, partida.erros), (3, 2));
    }

    #[test]
    fn fora_da_palhetada_soltar_nao_toca_a_nota_comum_do_traste_segurado() {
        for jeito in [JeitoDeJogar::Gamepad, JeitoDeJogar::Tapping] {
            let mut partida = criar_partida(&[na_pista(1.0, 1), na_pista(1.1, 0)], com_jeito(jeito));
            tocar(&mut partida, 0, 0.9);
            tocar(&mut partida, 1, 1.0);
            soltar(&mut partida, 1, 1.1);
            assert_eq!(partida.acertos, 1, "{jeito:?}");
        }
    }

    /// O começo de Through the Fire and Flames tocado rápido: cada traste de cima é apertado 30 ms antes e solto no
    /// tempo da própria nota, 75 ms antes do verde e antes de a janela dele abrir.
    fn verde_com_toques_rapidos(jeito: JeitoDeJogar) -> Partida {
        let passo = 0.075;
        let pistas = [0, 1, 0, 2, 0, 3, 0, 2, 0];
        let notas: Vec<Nota> = pistas
            .iter()
            .enumerate()
            .map(|(i, &p)| {
                if i == 0 {
                    na_pista(1.0, p)
                } else {
                    do_tipo(1.0 + i as f64 * passo, p, TipoDaNota::Hopo)
                }
            })
            .collect();
        let mut partida = criar_partida(&notas, com_jeito(jeito));
        tocar(&mut partida, 0, 0.98);
        if jeito == JeitoDeJogar::Palhetada {
            palhetar(&mut partida, 1.0);
        }
        for (i, &p) in pistas.iter().enumerate().skip(1).step_by(2) {
            let tempo = 1.0 + i as f64 * passo;
            tocar(&mut partida, p, tempo - 0.03);
            soltar(&mut partida, p, tempo);
        }
        avancar(&mut partida, 2.0);
        partida
    }

    #[test]
    fn soltar_antes_da_janela_ainda_pega_o_hopo_do_traste_segurado() {
        for jeito in [JeitoDeJogar::Palhetada, JeitoDeJogar::Gamepad] {
            let partida = verde_com_toques_rapidos(jeito);
            assert_eq!((partida.acertos, partida.erros, partida.toques_em_vazio), (9, 0, 0), "{jeito:?}");
        }
    }

    #[test]
    fn no_tapping_o_hopo_nao_sai_sozinho_nos_trastes_segurados() {
        let partida = verde_com_toques_rapidos(JeitoDeJogar::Tapping);
        assert_eq!((partida.acertos, partida.erros), (5, 4));
    }

    #[test]
    fn a_troca_de_trastes_fora_da_janela_nao_toca_o_hopo() {
        let notas = [na_pista(1.0, 0), do_tipo(1.2, 1, TipoDaNota::Hopo), do_tipo(1.5, 0, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.98);
        palhetar(&mut partida, 1.0);
        tocar(&mut partida, 1, 1.2);
        // Soltou o vermelho 120 ms antes do verde: a troca já não vale, e o verde passa.
        soltar(&mut partida, 1, 1.38);
        avancar(&mut partida, 2.0);
        assert_eq!((partida.acertos, partida.erros), (2, 1));
    }

    #[test]
    fn sem_troca_de_trastes_o_hopo_do_mesmo_traste_nao_sai_sozinho() {
        let notas = [na_pista(1.0, 1), do_tipo(1.075, 1, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 1, 0.98);
        palhetar(&mut partida, 1.0);
        avancar(&mut partida, 2.0);
        assert_eq!((partida.acertos, partida.erros), (1, 1));
    }

    #[test]
    fn sem_sequencia_o_hopo_nao_sai_sozinho() {
        let mut partida = palhetada(&[do_tipo(1.0, 1, TipoDaNota::Hopo)]);
        tocar(&mut partida, 1, 0.95);
        avancar(&mut partida, 2.0);
        assert_eq!(partida.acertos, 0);
    }

    #[test]
    fn sem_sequencia_o_hopo_precisa_da_palheta_e_o_tap_nao() {
        let mut partida = palhetada(&[do_tipo(1.0, 1, TipoDaNota::Hopo)]);
        assert!(!tocar(&mut partida, 1, 1.0));
        assert!(palhetar(&mut partida, 1.01));
        let mut partida = palhetada(&[do_tipo(1.0, 1, TipoDaNota::Tap)]);
        assert!(tocar(&mut partida, 1, 1.0));
    }

    #[test]
    fn a_palhetada_espera_50_ms_pelos_trastes() {
        let mut partida = palhetada(&[na_pista(1.0, 1)]);
        assert!(!palhetar(&mut partida, 0.98));
        assert!(tocar(&mut partida, 1, 1.02));
        assert_eq!((partida.acertos, partida.toques_em_vazio), (1, 0));
    }

    #[test]
    fn a_palhetada_sem_nota_vira_em_vao_quando_a_folga_acaba() {
        let mut partida = palhetada(&[na_pista(1.0, 0), na_pista(2.0, 0)]);
        tocar(&mut partida, 0, 0.9);
        palhetar(&mut partida, 1.0);
        palhetar(&mut partida, 1.5);
        avancar(&mut partida, 1.6);
        assert_eq!((partida.sequencia, partida.toques_em_vazio), (0, 1));
    }

    #[test]
    fn palhetar_logo_depois_do_hopo_nao_pune() {
        let notas = [na_pista(1.0, 0), do_tipo(1.2, 1, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.95);
        palhetar(&mut partida, 1.0);
        assert!(tocar(&mut partida, 1, 1.2));
        palhetar(&mut partida, 1.23);
        avancar(&mut partida, 1.5);
        assert_eq!((partida.sequencia, partida.toques_em_vazio), (2, 0));
    }

    #[test]
    fn a_palhetada_em_vao_cancela_a_frase_de_star_power_e_o_full_combo() {
        let frase = |t| Nota { frase: 0, ..na_pista(t, 0) };
        let mut partida = palhetada(&[frase(1.0), frase(2.0)]);
        tocar(&mut partida, 0, 0.9);
        palhetar(&mut partida, 1.0);
        palhetar(&mut partida, 1.5);
        palhetar(&mut partida, 2.0);
        avancar(&mut partida, 3.0);
        assert_eq!(partida.acertos, 2);
        assert_eq!(estrela(&partida), 0.0);
        assert!(!full_combo(&partida));
    }

    #[test]
    fn traste_errado_acima_do_hopo_faz_ele_precisar_da_palheta() {
        let notas = [na_pista(1.0, 0), do_tipo(1.2, 1, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.95);
        palhetar(&mut partida, 1.0);
        tocar(&mut partida, 3, 1.15);
        soltar(&mut partida, 3, 1.17);
        assert!(!tocar(&mut partida, 1, 1.2));
        assert!(palhetar(&mut partida, 1.21));
    }

    #[test]
    fn a_aberta_hopo_sai_soltando_os_trastes() {
        let notas = [na_pista(1.0, 0), do_tipo(1.2, PISTA_ABERTA, TipoDaNota::Hopo)];
        let mut partida = palhetada(&notas);
        tocar(&mut partida, 0, 0.95);
        palhetar(&mut partida, 1.0);
        soltar(&mut partida, 0, 1.2);
        assert_eq!(partida.acertos, 2);
    }

    #[test]
    fn frase_completa_enche_dois_compassos_e_a_barra_gasta_por_compasso() {
        let ritmo = Ritmo {
            batidas: vec![],
            compassos: (0..40).map(f64::from).collect(),
        };
        let frase = |t, f| Nota { frase: f, ..na_pista(t, 0) };
        let notas = [frase(1.0, 0), frase(2.0, 1), nota(10.0)];
        let mut partida = criar_partida_com_ritmo(&notas, &ritmo, OpcoesDaPartida::default());
        tocar(&mut partida, 0, 1.0);
        tocar(&mut partida, 0, 2.0);
        assert_eq!(estrela(&partida), 0.5);
        assert!(ativar_estrela(&mut partida));
        avancar(&mut partida, 4.0);
        assert!(partida.estrela_ativa);
        avancar(&mut partida, 6.5);
        assert!(!partida.estrela_ativa);
    }

    #[test]
    fn o_solo_rende_bonus_de_100_por_nota_no_cheio() {
        let solo = |t| Nota { solo: 0, ..nota(t) };
        let mut partida = criar_partida(&[solo(1.0), solo(1.5)], OpcoesDaPartida::default());
        tocar(&mut partida, 0, 1.0);
        tocar(&mut partida, 0, 1.5);
        assert_eq!(partida.bonus_de_solo, 200.0);
        assert_eq!(partida.pontos, 300.0);
    }

    #[test]
    fn solo_abaixo_de_60_por_cento_nao_rende_bonus() {
        let solo = |t| Nota { solo: 0, ..nota(t) };
        let mut partida = criar_partida(&[solo(1.0), solo(2.0), solo(3.0)], OpcoesDaPartida::default());
        tocar(&mut partida, 0, 1.0);
        avancar(&mut partida, 4.0);
        assert_eq!(partida.bonus_de_solo, 0.0);
    }

    #[test]
    fn no_gamepad_soltar_a_tecla_acerta_a_proxima_nota_da_pista() {
        let mut partida = criar_partida(&[nota(1.0), nota(1.06)], com_jeito(JeitoDeJogar::Gamepad));
        assert!(tocar(&mut partida, 0, 1.0));
        soltar(&mut partida, 0, 1.06);
        assert_eq!(partida.acertos, 2);
    }

    #[test]
    fn no_tapping_cada_aperto_vale_uma_nota_e_soltar_nao_acerta() {
        let mut partida = criar_partida(&[nota(1.0), nota(1.2)], com_jeito(JeitoDeJogar::Tapping));
        assert!(tocar(&mut partida, 0, 1.0));
        soltar(&mut partida, 0, 1.2);
        assert_eq!(partida.acertos, 1);
        assert!(tocar(&mut partida, 0, 1.2));
    }

    #[test]
    fn tocar_em_vazio_zera_o_combo_e_tira_vida_sem_contar_como_nota_errada() {
        let mut partida = criar_partida(&[nota(1.0), nota(2.0)], OpcoesDaPartida::default());
        assert!(tocar(&mut partida, 0, 1.0));
        let vida = partida.vida;
        assert!(!tocar(&mut partida, 0, 1.5));
        assert_eq!((partida.sequencia, partida.erros), (0, 0));
        assert!(partida.vida < vida);
        assert!(retirar_eventos(&mut partida).contains(&Evento::ToqueEmVazio { pista: Some(0) }));
    }

    #[test]
    fn sem_aberta_a_nota_aberta_vira_verde() {
        let aberta = Nota {
            frase: 3,
            duracao: 0.5,
            ..Nota::simples(1.0, PISTA_ABERTA)
        };
        let opcoes = OpcoesDaPartida {
            sem_aberta: true,
            ..OpcoesDaPartida::default()
        };
        let mut partida = criar_partida(&[aberta, na_pista(2.0, 2)], opcoes);
        assert_eq!(partida.notas.iter().map(|n| n.pista).collect::<Vec<_>>(), [0, 2]);
        assert!(tocar(&mut partida, 0, 1.0));
    }

    #[test]
    fn julga_pela_distancia_ate_a_batida_como_no_mania() {
        assert_eq!(julgar(0.016), Julgamento::Max);
        assert_eq!(julgar(-0.017), Julgamento::J300);
        assert_eq!(julgar(0.04), Julgamento::J300);
        assert_eq!(julgar(-0.073), Julgamento::J200);
        assert_eq!(julgar(0.103), Julgamento::J100);
        assert_eq!(julgar(0.104), Julgamento::J50);
        assert_eq!(julgar(-0.11), Julgamento::J50);
    }

    #[test]
    fn os_pesos_sao_os_do_score_v1() {
        let pesos = [Julgamento::Max, Julgamento::J300, Julgamento::J200, Julgamento::J100, Julgamento::J50].map(Julgamento::valor);
        assert_eq!(pesos, [300, 300, 200, 100, 50]);
    }

    #[test]
    fn arredonda_o_meio_como_o_javascript() {
        assert_eq!(arredondar(-2.5), -2.0);
        assert_eq!(arredondar(2.5), 3.0);
    }

    #[test]
    fn a_grade_segue_as_marcas_e_sem_elas_usa_120_bpm() {
        assert!((posicao_na_grade(&[0.0, 1.0, 3.0], 0.5, 2.0) - 1.5).abs() < 1e-9);
        assert!((posicao_na_grade(&[], 0.5, 2.0) - 4.0).abs() < 1e-9);
        assert!((posicao_na_grade(&[0.0, 1.0], 0.5, 3.0) - 3.0).abs() < 1e-9);
    }
}
