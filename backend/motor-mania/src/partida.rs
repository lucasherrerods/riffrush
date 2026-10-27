//! As regras da partida do Mania: julgamento por coluna, notas longas, precisão, pontuação, nota final e vida.
//! O tempo é em milissegundos inteiros, como no `.osu`: o replay guarda os mesmos números e a partida se repete igual.

use crate::beatmap::{Beatmap, Nota};
use crate::mods::{colunas_com_mods, Mods};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Julgamento {
    Max,
    J300,
    J200,
    J100,
    J50,
    Miss,
}

impl Julgamento {
    /// Peso na precisão: o MAX vale um pouco mais que o 300.
    pub fn peso(self) -> u32 {
        match self {
            Julgamento::Max => 305,
            Julgamento::J300 => 300,
            Julgamento::J200 => 200,
            Julgamento::J100 => 100,
            Julgamento::J50 => 50,
            Julgamento::Miss => 0,
        }
    }
}

const JULGAMENTOS: [Julgamento; 6] = [
    Julgamento::Max,
    Julgamento::J300,
    Julgamento::J200,
    Julgamento::J100,
    Julgamento::J50,
    Julgamento::Miss,
];
const PESO_MAXIMO: u32 = 305;

/// Metade da largura de cada janela, em ms, em volta do tempo da nota. A do Miss é a de antecedência: um toque mais
/// cedo que ela é ignorado; entre ela e a do 50, o toque conta como Miss.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Janelas {
    pub max: f64,
    pub j300: f64,
    pub j200: f64,
    pub j100: f64,
    pub j50: f64,
    pub miss: f64,
}

impl Janelas {
    /// As janelas do mania pelo Overall Difficulty.
    pub fn do_od(od: f64) -> Self {
        Self {
            max: 16.0,
            j300: 64.0 - 3.0 * od,
            j200: 97.0 - 3.0 * od,
            j100: 127.0 - 3.0 * od,
            j50: 151.0 - 3.0 * od,
            miss: 188.0 - 3.0 * od,
        }
    }

    pub fn escaladas(self, fator: f64) -> Self {
        Self {
            max: self.max * fator,
            j300: self.j300 * fator,
            j200: self.j200 * fator,
            j100: self.j100 * fator,
            j50: self.j50 * fator,
            miss: self.miss * fator,
        }
    }

    /// O julgamento de um toque `desvio` ms fora do tempo, ou `None` se ele cai fora da janela do 50.
    pub fn julgar(&self, desvio: f64) -> Option<Julgamento> {
        let d = desvio.abs();
        [
            (self.max, Julgamento::Max),
            (self.j300, Julgamento::J300),
            (self.j200, Julgamento::J200),
            (self.j100, Julgamento::J100),
            (self.j50, Julgamento::J50),
        ]
        .into_iter()
        .find(|&(janela, _)| d <= janela)
        .map(|(_, j)| j)
    }
}

/// A ponta da nota longa é julgada ao soltar, com janelas mais largas que as do toque.
pub const FATOR_DA_PONTA: f64 = 1.5;

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct OpcoesDaPartida {
    pub mods: Mods,
    /// Semente do mod Random.
    pub semente: u32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Evento {
    /// `nota` é o índice em `Partida::notas`; `ponta` diz se foi o fim de uma nota longa.
    Julgamento {
        nota: usize,
        coluna: u8,
        julgamento: Julgamento,
        ponta: bool,
        desvio_ms: Option<i32>,
    },
    Derrota,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Estado {
    Esperando,
    /// Nota longa com a cabeça acertada, ainda segurada.
    Segurando,
    Terminada,
}

#[derive(Debug, Clone)]
pub struct Partida {
    pub notas: Vec<Nota>,
    pub teclas: u8,
    pub janelas: Janelas,
    hp: f64,
    opcoes: OpcoesDaPartida,
    estados: Vec<Estado>,
    /// Por coluna, os índices das notas em ordem e a próxima ainda não terminada.
    por_coluna: Vec<Vec<usize>>,
    proxima: Vec<usize>,
    pub tempo_ms: i32,
    pub contagem: [u32; 6],
    pub combo: u32,
    pub maior_combo: u32,
    /// De 0 a 1.
    pub vida: f64,
    pub derrota: bool,
    eventos: Vec<Evento>,
}

/// As notas chegam no tempo da música e a partida roda no tempo real: com DT, a nota no segundo 3 da música chega no
/// segundo 2. As janelas ficam no tempo da música, então encolhem no tempo real junto com ela.
pub fn criar_partida(beatmap: &Beatmap, opcoes: OpcoesDaPartida) -> Partida {
    let teclas = beatmap.dificuldade.teclas;
    let mods = opcoes.mods;
    let velocidade = mods.velocidade();
    let colunas = colunas_com_mods(teclas, mods, opcoes.semente);
    let no_tempo_real = |tempo: i32| (f64::from(tempo) / velocidade).round() as i32;
    let mut notas: Vec<Nota> = beatmap
        .notas
        .iter()
        .map(|n| Nota {
            coluna: colunas[usize::from(n.coluna)],
            tempo_ms: no_tempo_real(n.tempo_ms),
            fim_ms: n.fim_ms.map(no_tempo_real),
        })
        .collect();
    notas.sort_by_key(|n| (n.tempo_ms, n.coluna));
    let mut por_coluna = vec![Vec::new(); usize::from(teclas)];
    for (indice, nota) in notas.iter().enumerate() {
        por_coluna[usize::from(nota.coluna)].push(indice);
    }
    Partida {
        estados: vec![Estado::Esperando; notas.len()],
        notas,
        teclas,
        janelas: Janelas::do_od(beatmap.dificuldade.od).escaladas(mods.fator_das_janelas() / velocidade),
        hp: beatmap.dificuldade.hp,
        opcoes,
        proxima: vec![0; usize::from(teclas)],
        por_coluna,
        tempo_ms: i32::MIN,
        contagem: [0; 6],
        combo: 0,
        maior_combo: 0,
        vida: 1.0,
        derrota: false,
        eventos: Vec::new(),
    }
}

/// Total de julgamentos do mapa: um por nota simples e dois por nota longa (cabeça e ponta).
pub fn total_de_julgamentos(partida: &Partida) -> u32 {
    partida.notas.iter().map(|n| if n.fim_ms.is_some() { 2 } else { 1 }).sum()
}

fn julgados(partida: &Partida) -> u32 {
    partida.contagem.iter().sum()
}

/// De 0 a 1, sobre o que já foi julgado. Começa em 1.
pub fn precisao(partida: &Partida) -> f64 {
    let julgados = julgados(partida);
    if julgados == 0 {
        return 1.0;
    }
    let soma: u32 = JULGAMENTOS.iter().zip(partida.contagem).map(|(j, n)| j.peso() * n).sum();
    f64::from(soma) / f64::from(PESO_MAXIMO * julgados)
}

/// Até 1.000.000: 99% pela precisão e 1% pelo maior combo, sobre o mapa inteiro, vezes o multiplicador dos mods.
pub fn pontuacao(partida: &Partida) -> u32 {
    let total = total_de_julgamentos(partida);
    if total == 0 {
        return 0;
    }
    let soma: u32 = JULGAMENTOS.iter().zip(partida.contagem).map(|(j, n)| j.peso() * n).sum();
    let parte_da_precisao = f64::from(soma) / f64::from(PESO_MAXIMO * total);
    let parte_do_combo = f64::from(partida.maior_combo) / f64::from(total);
    (1_000_000.0 * (0.99 * parte_da_precisao + 0.01 * parte_do_combo) * partida.opcoes.mods.multiplicador()).round() as u32
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Classificacao {
    SS,
    S,
    A,
    B,
    C,
    D,
}

/// As faixas do osu!mania: SS só com 100%, e as outras acima do limite (95% é A).
pub fn classificacao(precisao: f64) -> Classificacao {
    match precisao {
        p if p >= 1.0 - 1e-9 => Classificacao::SS,
        p if p > 0.95 => Classificacao::S,
        p if p > 0.9 => Classificacao::A,
        p if p > 0.8 => Classificacao::B,
        p if p > 0.7 => Classificacao::C,
        _ => Classificacao::D,
    }
}

/// Quanto cada julgamento mexe na vida. O HP do mapa (0 a 10) deixa o erro mais caro.
fn variacao_da_vida(julgamento: Julgamento, hp: f64, mods: Mods) -> f64 {
    let peso_do_hp = (1.0 + hp / 10.0) * if mods.tem(Mods::EZ) { 0.5 } else { 1.0 };
    match julgamento {
        Julgamento::Max | Julgamento::J300 => 0.01,
        Julgamento::J200 => 0.005,
        Julgamento::J100 => 0.0,
        Julgamento::J50 => -0.01 * peso_do_hp,
        Julgamento::Miss => -0.04 * peso_do_hp,
    }
}

fn registrar(partida: &mut Partida, nota: usize, julgamento: Julgamento, ponta: bool, desvio_ms: Option<i32>) {
    let posicao = JULGAMENTOS.iter().position(|&j| j == julgamento).unwrap_or(5);
    partida.contagem[posicao] += 1;
    if julgamento == Julgamento::Miss {
        partida.combo = 0;
    } else {
        partida.combo += 1;
        partida.maior_combo = partida.maior_combo.max(partida.combo);
    }
    partida.vida = (partida.vida + variacao_da_vida(julgamento, partida.hp, partida.opcoes.mods)).clamp(0.0, 1.0);
    let coluna = partida.notas[nota].coluna;
    partida.eventos.push(Evento::Julgamento {
        nota,
        coluna,
        julgamento,
        ponta,
        desvio_ms,
    });
    let mods = partida.opcoes.mods;
    let falhou = (partida.vida <= 0.0 && !mods.tem(Mods::NF))
        || (mods.tem(Mods::SD) && julgamento == Julgamento::Miss)
        || (mods.tem(Mods::PF) && julgamento != Julgamento::Max);
    if falhou && !partida.derrota {
        partida.derrota = true;
        partida.eventos.push(Evento::Derrota);
    }
}

fn terminar(partida: &mut Partida, nota: usize) {
    partida.estados[nota] = Estado::Terminada;
    let coluna = usize::from(partida.notas[nota].coluna);
    let lista = &partida.por_coluna[coluna];
    let mut proxima = partida.proxima[coluna];
    while proxima < lista.len() && partida.estados[lista[proxima]] == Estado::Terminada {
        proxima += 1;
    }
    partida.proxima[coluna] = proxima;
}

/// Leva a partida até `tempo_ms`: as notas que passaram sem toque viram Miss, e a nota longa segurada até depois da
/// janela da ponta termina com MAX.
pub fn avancar(partida: &mut Partida, tempo_ms: i32) {
    if partida.derrota || tempo_ms <= partida.tempo_ms {
        partida.tempo_ms = partida.tempo_ms.max(tempo_ms);
        return;
    }
    partida.tempo_ms = tempo_ms;
    let janela_da_ponta = partida.janelas.j50 * FATOR_DA_PONTA;
    for coluna in 0..usize::from(partida.teclas) {
        let mut posicao = partida.proxima[coluna];
        while let Some(&nota) = partida.por_coluna[coluna].get(posicao) {
            if partida.derrota {
                return;
            }
            let n = partida.notas[nota];
            match partida.estados[nota] {
                Estado::Terminada => {}
                Estado::Esperando if f64::from(tempo_ms - n.tempo_ms) > partida.janelas.j50 => {
                    registrar(partida, nota, Julgamento::Miss, false, None);
                    if n.fim_ms.is_some() {
                        registrar(partida, nota, Julgamento::Miss, true, None);
                    }
                    terminar(partida, nota);
                }
                Estado::Segurando if f64::from(tempo_ms - n.fim_ms.unwrap_or(n.tempo_ms)) > janela_da_ponta => {
                    registrar(partida, nota, Julgamento::Max, true, None);
                    terminar(partida, nota);
                }
                // A primeira nota ainda no tempo segura as de trás da coluna.
                _ => break,
            }
            posicao += 1;
        }
    }
}

/// Toque na coluna. Devolve o julgamento da nota acertada, ou `None` se o toque foi cedo demais (ou não havia nota).
pub fn tocar(partida: &mut Partida, coluna: u8, tempo_ms: i32) -> Option<Julgamento> {
    avancar(partida, tempo_ms);
    if partida.derrota || coluna >= partida.teclas {
        return None;
    }
    let indice = usize::from(coluna);
    let nota = *partida.por_coluna[indice].get(partida.proxima[indice])?;
    if partida.estados[nota] != Estado::Esperando {
        return None;
    }
    let n = partida.notas[nota];
    let desvio = tempo_ms - n.tempo_ms;
    if f64::from(-desvio) > partida.janelas.miss {
        return None;
    }
    let julgamento = partida.janelas.julgar(f64::from(desvio)).unwrap_or(Julgamento::Miss);
    registrar(partida, nota, julgamento, false, Some(desvio));
    if n.fim_ms.is_some() && julgamento != Julgamento::Miss {
        partida.estados[nota] = Estado::Segurando;
    } else {
        if n.fim_ms.is_some() {
            registrar(partida, nota, Julgamento::Miss, true, None);
        }
        terminar(partida, nota);
    }
    Some(julgamento)
}

/// Soltar a coluna. Só importa com uma nota longa segurada: julga a ponta. Soltar cedo demais é Miss na ponta.
pub fn soltar(partida: &mut Partida, coluna: u8, tempo_ms: i32) -> Option<Julgamento> {
    avancar(partida, tempo_ms);
    if partida.derrota || coluna >= partida.teclas {
        return None;
    }
    let indice = usize::from(coluna);
    let nota = *partida.por_coluna[indice].get(partida.proxima[indice])?;
    if partida.estados[nota] != Estado::Segurando {
        return None;
    }
    let desvio = tempo_ms - partida.notas[nota].fim_ms.unwrap_or(tempo_ms);
    let julgamento = partida.janelas.escaladas(FATOR_DA_PONTA).julgar(f64::from(desvio)).unwrap_or(Julgamento::Miss);
    registrar(partida, nota, julgamento, true, Some(desvio));
    terminar(partida, nota);
    Some(julgamento)
}

pub fn retirar_eventos(partida: &mut Partida) -> Vec<Evento> {
    std::mem::take(&mut partida.eventos)
}

/// A partida acabou: todas as notas julgadas, ou derrota.
pub fn terminou(partida: &Partida) -> bool {
    partida.derrota || partida.estados.iter().all(|&e| e == Estado::Terminada)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::beatmap::{Dificuldade, Geral, Metadados};

    fn mapa(od: f64, hp: f64, notas: &[(u8, i32, Option<i32>)]) -> Beatmap {
        Beatmap {
            versao_do_formato: 14,
            geral: Geral::default(),
            metadados: Metadados::default(),
            dificuldade: Dificuldade { teclas: 4, od, hp },
            fundo: None,
            video: None,
            pontos_de_tempo: Vec::new(),
            notas: notas.iter().map(|&(coluna, tempo_ms, fim_ms)| Nota { coluna, tempo_ms, fim_ms }).collect(),
        }
    }

    fn partida(notas: &[(u8, i32, Option<i32>)]) -> Partida {
        // OD 5: 300 em ±49, 200 em ±82, 100 em ±112, 50 em ±136 e Miss antecipado a partir de 173 ms.
        criar_partida(&mapa(5.0, 5.0, notas), OpcoesDaPartida::default())
    }

    #[test]
    fn janelas_pelo_od() {
        let j = Janelas::do_od(8.0);
        assert_eq!((j.max, j.j300, j.j200, j.j100, j.j50, j.miss), (16.0, 40.0, 73.0, 103.0, 127.0, 164.0));
    }

    #[test]
    fn julga_pelo_desvio_nos_dois_sentidos() {
        let j = Janelas::do_od(5.0);
        assert_eq!(j.julgar(0.0), Some(Julgamento::Max));
        assert_eq!(j.julgar(-16.0), Some(Julgamento::Max));
        assert_eq!(j.julgar(17.0), Some(Julgamento::J300));
        assert_eq!(j.julgar(-49.0), Some(Julgamento::J300));
        assert_eq!(j.julgar(82.0), Some(Julgamento::J200));
        assert_eq!(j.julgar(-112.0), Some(Julgamento::J100));
        assert_eq!(j.julgar(136.0), Some(Julgamento::J50));
        assert_eq!(j.julgar(137.0), None);
    }

    #[test]
    fn toque_na_hora_certa_e_max() {
        let mut p = partida(&[(0, 1000, None)]);
        assert_eq!(tocar(&mut p, 0, 1005), Some(Julgamento::Max));
        assert_eq!((p.combo, p.contagem[0]), (1, 1));
        assert!(terminou(&p));
        assert_eq!(pontuacao(&p), 1_000_000);
        assert_eq!(classificacao(precisao(&p)), Classificacao::SS);
    }

    #[test]
    fn toque_cedo_demais_e_ignorado_e_um_pouco_cedo_e_miss() {
        let mut p = partida(&[(0, 1000, None)]);
        assert_eq!(tocar(&mut p, 0, 800), None);
        assert_eq!(p.combo, 0);
        assert_eq!(tocar(&mut p, 0, 850), Some(Julgamento::Miss));
        assert!(terminou(&p));
    }

    #[test]
    fn so_a_coluna_certa_acerta() {
        let mut p = partida(&[(2, 1000, None)]);
        assert_eq!(tocar(&mut p, 1, 1000), None);
        assert_eq!(tocar(&mut p, 9, 1000), None);
        assert_eq!(tocar(&mut p, 2, 1000), Some(Julgamento::Max));
    }

    #[test]
    fn nota_que_passa_sem_toque_vira_miss_e_quebra_o_combo() {
        let mut p = partida(&[(0, 1000, None), (1, 1100, None), (0, 2000, None)]);
        tocar(&mut p, 1, 1100);
        avancar(&mut p, 1136);
        assert_eq!(p.contagem[5], 0);
        avancar(&mut p, 1137);
        assert_eq!((p.contagem[5], p.combo), (1, 0));
        // A nota perdida não prende a próxima da coluna.
        assert_eq!(tocar(&mut p, 0, 2000), Some(Julgamento::Max));
        assert_eq!(p.maior_combo, 1);
    }

    #[test]
    fn um_toque_acerta_so_a_primeira_nota_da_coluna() {
        let mut p = partida(&[(0, 1000, None), (0, 1050, None)]);
        assert_eq!(tocar(&mut p, 0, 1040), Some(Julgamento::J300));
        assert_eq!(tocar(&mut p, 0, 1050), Some(Julgamento::Max));
    }

    #[test]
    fn nota_longa_julga_cabeca_e_ponta() {
        let mut p = partida(&[(0, 1000, Some(2000))]);
        assert_eq!(total_de_julgamentos(&p), 2);
        assert_eq!(tocar(&mut p, 0, 1000), Some(Julgamento::Max));
        assert!(!terminou(&p));
        // A ponta tem janelas 1,5 vez mais largas: 60 ms de atraso ainda é 300 (49 × 1,5 = 73,5).
        assert_eq!(soltar(&mut p, 0, 2060), Some(Julgamento::J300));
        assert!(terminou(&p));
        assert_eq!(p.combo, 2);
    }

    #[test]
    fn soltar_cedo_demais_e_miss_na_ponta() {
        let mut p = partida(&[(0, 1000, Some(2000))]);
        tocar(&mut p, 0, 1000);
        assert_eq!(soltar(&mut p, 0, 1500), Some(Julgamento::Miss));
        assert_eq!(p.combo, 0);
        assert!(terminou(&p));
    }

    #[test]
    fn segurar_alem_da_ponta_termina_com_max() {
        let mut p = partida(&[(0, 1000, Some(2000))]);
        tocar(&mut p, 0, 1000);
        avancar(&mut p, 2300);
        assert_eq!(p.contagem[0], 2);
        assert!(terminou(&p));
        assert_eq!(soltar(&mut p, 0, 2400), None);
    }

    #[test]
    fn perder_a_cabeca_perde_a_nota_longa_inteira() {
        let mut p = partida(&[(0, 1000, Some(2000))]);
        avancar(&mut p, 1500);
        assert_eq!(p.contagem[5], 2);
        assert!(terminou(&p));
    }

    #[test]
    fn precisao_e_pontuacao_pelos_pesos() {
        let mut p = partida(&[(0, 1000, None), (1, 1000, None)]);
        tocar(&mut p, 0, 1000);
        tocar(&mut p, 1, 1100);
        // (305 + 100) / 610.
        assert!((precisao(&p) - 405.0 / 610.0).abs() < 1e-12);
        assert_eq!(classificacao(precisao(&p)), Classificacao::D);
        assert_eq!(pontuacao(&p), (1_000_000.0_f64 * (0.99 * 405.0 / 610.0 + 0.01)).round() as u32);
    }

    #[test]
    fn classificacao_por_faixa() {
        assert_eq!(classificacao(0.9501), Classificacao::S);
        assert_eq!(classificacao(0.95), Classificacao::A);
        assert_eq!(classificacao(0.81), Classificacao::B);
        assert_eq!(classificacao(0.8), Classificacao::C);
        assert_eq!(classificacao(0.7), Classificacao::D);
    }

    #[test]
    fn a_vida_zera_com_muitos_erros_e_a_partida_para() {
        let notas: Vec<_> = (0..20).map(|i| (0, 1000 + i * 100, None)).collect();
        let mut p = criar_partida(&mapa(5.0, 10.0, &notas), OpcoesDaPartida::default());
        avancar(&mut p, 10_000);
        assert!(p.derrota);
        // Com HP 10, cada erro tira 8%: a derrota vem no 13º.
        assert_eq!(p.contagem[5], 13);
        assert!(retirar_eventos(&mut p).contains(&Evento::Derrota));
        assert_eq!(tocar(&mut p, 0, 10_000), None);
    }

    #[test]
    fn sem_falha_nao_perde() {
        let notas: Vec<_> = (0..20).map(|i| (0, 1000 + i * 100, None)).collect();
        let mut p = criar_partida(
            &mapa(5.0, 10.0, &notas),
            OpcoesDaPartida {
                mods: Mods::NF,
                ..OpcoesDaPartida::default()
            },
        );
        avancar(&mut p, 10_000);
        assert!(!p.derrota);
        assert_eq!(p.contagem[5], 20);
        assert_eq!(p.vida, 0.0);
    }

    #[test]
    fn os_eventos_trazem_o_desvio_para_o_hud() {
        let mut p = partida(&[(3, 1000, None)]);
        tocar(&mut p, 3, 990);
        assert_eq!(
            retirar_eventos(&mut p),
            [Evento::Julgamento {
                nota: 0,
                coluna: 3,
                julgamento: Julgamento::Max,
                ponta: false,
                desvio_ms: Some(-10)
            }]
        );
        assert!(retirar_eventos(&mut p).is_empty());
    }

    fn com_mods(mods: Mods, notas: &[(u8, i32, Option<i32>)]) -> Partida {
        criar_partida(&mapa(5.0, 5.0, notas), OpcoesDaPartida { mods, semente: 7 })
    }

    #[test]
    fn dt_traz_as_notas_para_o_tempo_real_e_encolhe_as_janelas() {
        let mut p = com_mods(Mods::DT, &[(0, 3000, Some(4500))]);
        assert_eq!(
            p.notas[0],
            Nota {
                coluna: 0,
                tempo_ms: 2000,
                fim_ms: Some(3000)
            }
        );
        // A janela do 300 é de 49 ms na música: 32,7 ms no tempo real.
        assert_eq!(tocar(&mut p, 0, 2033), Some(Julgamento::J200));
    }

    #[test]
    fn ht_estica_o_tempo() {
        let p = com_mods(Mods::HT, &[(0, 3000, None)]);
        assert_eq!(p.notas[0].tempo_ms, 4000);
    }

    #[test]
    fn hr_encolhe_e_ez_alarga_as_janelas() {
        // 300 em ±49: com HR, ±35; com EZ, ±68,6.
        assert_eq!(tocar(&mut com_mods(Mods::HR, &[(0, 1000, None)]), 0, 1040), Some(Julgamento::J200));
        assert_eq!(tocar(&mut com_mods(Mods::EZ, &[(0, 1000, None)]), 0, 1060), Some(Julgamento::J300));
    }

    #[test]
    fn ez_perde_metade_da_vida_e_reduz_a_pontuacao() {
        let mut normal = com_mods(Mods::NENHUM, &[(0, 1000, None)]);
        let mut facil = com_mods(Mods::EZ, &[(0, 1000, None)]);
        avancar(&mut normal, 2000);
        avancar(&mut facil, 2000);
        assert!((1.0 - facil.vida - (1.0 - normal.vida) / 2.0).abs() < 1e-12);
        let mut acerto = com_mods(Mods::EZ, &[(0, 1000, None)]);
        tocar(&mut acerto, 0, 1000);
        assert_eq!(pontuacao(&acerto), 500_000);
    }

    #[test]
    fn sd_perde_no_primeiro_miss_e_pf_no_primeiro_abaixo_do_max() {
        let mut sd = com_mods(Mods::SD, &[(0, 1000, None), (1, 1000, None)]);
        tocar(&mut sd, 0, 1040);
        assert!(!sd.derrota);
        avancar(&mut sd, 2000);
        assert!(sd.derrota);
        let mut pf = com_mods(Mods::PF, &[(0, 1000, None)]);
        tocar(&mut pf, 0, 1020);
        assert!(pf.derrota);
    }

    #[test]
    fn mirror_e_random_mudam_as_colunas() {
        let p = com_mods(Mods::MIRROR, &[(0, 1000, None), (3, 2000, None)]);
        assert_eq!(p.notas.iter().map(|n| n.coluna).collect::<Vec<_>>(), [3, 0]);
        let aleatoria = com_mods(Mods::RANDOM, &[(0, 1000, None), (1, 1100, None), (2, 1200, None), (3, 1300, None)]);
        let mut colunas: Vec<_> = aleatoria.notas.iter().map(|n| n.coluna).collect();
        colunas.sort_unstable();
        assert_eq!(colunas, [0, 1, 2, 3]);
    }

    #[test]
    fn o_tempo_nao_volta() {
        let mut p = partida(&[(0, 1000, None)]);
        avancar(&mut p, 1500);
        avancar(&mut p, 900);
        assert_eq!(p.tempo_ms, 1500);
        assert_eq!(tocar(&mut p, 0, 1000), None);
    }
}
