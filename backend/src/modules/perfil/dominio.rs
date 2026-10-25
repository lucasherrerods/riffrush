use std::collections::HashMap;

use chrono::{DateTime, Utc};

use crate::modules::catalogo::DadosDaMusica;
use crate::modules::conta::Conta;
use crate::modules::progresso::{Dificuldade, Instrumento, Nivel};

/// Quantas partidas o perfil mostra na lista das últimas.
pub const PARTIDAS_RECENTES: u32 = 10;
/// Quantas músicas entram na lista das mais tocadas.
pub const MAIS_TOCADAS: u32 = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartidasNoInstrumento {
    pub instrumento: Instrumento,
    pub partidas: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MusicaMaisTocada {
    pub musica_id: String,
    pub partidas: u32,
}

/// As partidas de uma conta numa dificuldade, já somadas pelo banco.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EstatisticasDaDificuldade {
    pub dificuldade: Dificuldade,
    pub partidas: u32,
    pub derrotas: u32,
    pub acertos: u64,
    pub notas: u64,
    pub melhor_pontuacao: u64,
}

impl EstatisticasDaDificuldade {
    pub fn precisao(&self) -> f64 {
        precisao(self.acertos, self.notas)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PartidaRecente {
    pub musica_id: String,
    pub dificuldade: Dificuldade,
    pub pontos: u64,
    pub acertos: u32,
    pub total: u32,
    pub derrota: bool,
    pub jogada_em: DateTime<Utc>,
}

/// O que o repositório devolve sobre uma conta.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DadosDoPerfil {
    pub criada_em: DateTime<Utc>,
    pub musicas_distintas: u32,
    pub por_dificuldade: Vec<EstatisticasDaDificuldade>,
    pub por_instrumento: Vec<PartidasNoInstrumento>,
    /// Da mais tocada para a menos, até `MAIS_TOCADAS`.
    pub mais_tocadas: Vec<MusicaMaisTocada>,
    pub recentes: Vec<PartidaRecente>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Perfil {
    pub conta: Conta,
    pub nivel: Nivel,
    pub criada_em: DateTime<Utc>,
    pub partidas: u32,
    pub derrotas: u32,
    /// De 0 a 1, contando todas as notas de todas as partidas.
    pub precisao: f64,
    pub melhor_pontuacao: u64,
    pub musicas_distintas: u32,
    /// Sempre as quatro, da mais fácil para a mais difícil, mesmo sem partidas.
    pub por_dificuldade: Vec<EstatisticasDaDificuldade>,
    /// Só os instrumentos jogados, do mais jogado para o menos.
    pub por_instrumento: Vec<PartidasNoInstrumento>,
    pub mais_tocadas: Vec<MusicaMaisTocada>,
    pub recentes: Vec<PartidaRecente>,
    /// Nome, banda e capa das músicas das listas acima, pelo id. Música do jogo fica de fora.
    pub musicas: HashMap<String, DadosDaMusica>,
}

impl Perfil {
    /// Os ids das músicas que o perfil mostra, sem repetir, na ordem em que aparecem.
    pub fn ids_das_musicas(&self) -> Vec<String> {
        let mut ids: Vec<String> = Vec::new();
        for id in self.mais_tocadas.iter().map(|m| &m.musica_id).chain(self.recentes.iter().map(|p| &p.musica_id)) {
            if !ids.contains(id) {
                ids.push(id.clone());
            }
        }
        ids
    }
}

fn precisao(acertos: u64, notas: u64) -> f64 {
    if notas == 0 {
        0.0
    } else {
        acertos as f64 / notas as f64
    }
}

/// Soma as dificuldades no total e completa as que a conta nunca jogou.
pub fn montar_perfil(conta: Conta, dados: DadosDoPerfil) -> Perfil {
    let por_dificuldade: Vec<_> = [Dificuldade::Facil, Dificuldade::Medio, Dificuldade::Dificil, Dificuldade::Expert]
        .into_iter()
        .map(|dificuldade| {
            dados
                .por_dificuldade
                .iter()
                .find(|e| e.dificuldade == dificuldade)
                .cloned()
                .unwrap_or(EstatisticasDaDificuldade {
                    dificuldade,
                    partidas: 0,
                    derrotas: 0,
                    acertos: 0,
                    notas: 0,
                    melhor_pontuacao: 0,
                })
        })
        .collect();
    let mut por_instrumento: Vec<_> = dados.por_instrumento.into_iter().filter(|i| i.partidas > 0).collect();
    por_instrumento.sort_by_key(|i| std::cmp::Reverse(i.partidas));
    let acertos = por_dificuldade.iter().map(|e| e.acertos).sum();
    let notas = por_dificuldade.iter().map(|e| e.notas).sum();
    Perfil {
        nivel: conta.nivel(),
        conta,
        criada_em: dados.criada_em,
        partidas: por_dificuldade.iter().map(|e| e.partidas).sum(),
        derrotas: por_dificuldade.iter().map(|e| e.derrotas).sum(),
        precisao: precisao(acertos, notas),
        melhor_pontuacao: por_dificuldade.iter().map(|e| e.melhor_pontuacao).max().unwrap_or(0),
        musicas_distintas: dados.musicas_distintas,
        por_dificuldade,
        por_instrumento,
        mais_tocadas: dados.mais_tocadas,
        recentes: dados.recentes,
        musicas: HashMap::new(),
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;

    fn conta() -> Conta {
        Conta {
            id: Uuid::nil(),
            nome: "Lucas".into(),
            avatar: None,
            email: None,
            xp_total: 0,
        }
    }

    fn estatisticas(dificuldade: Dificuldade, partidas: u32, acertos: u64, notas: u64, melhor: u64) -> EstatisticasDaDificuldade {
        EstatisticasDaDificuldade {
            dificuldade,
            partidas,
            derrotas: 1,
            acertos,
            notas,
            melhor_pontuacao: melhor,
        }
    }

    fn dados(por_dificuldade: Vec<EstatisticasDaDificuldade>) -> DadosDoPerfil {
        DadosDoPerfil {
            criada_em: DateTime::UNIX_EPOCH,
            musicas_distintas: 3,
            por_dificuldade,
            por_instrumento: vec![],
            mais_tocadas: vec![],
            recentes: vec![],
        }
    }

    #[test]
    fn conta_nova_tem_tudo_zerado_e_as_quatro_dificuldades() {
        let perfil = montar_perfil(conta(), dados(vec![]));
        assert_eq!((perfil.partidas, perfil.derrotas, perfil.melhor_pontuacao), (0, 0, 0));
        assert_eq!(perfil.precisao, 0.0);
        let ordem: Vec<_> = perfil.por_dificuldade.iter().map(|e| e.dificuldade).collect();
        assert_eq!(ordem, [Dificuldade::Facil, Dificuldade::Medio, Dificuldade::Dificil, Dificuldade::Expert]);
    }

    #[test]
    fn soma_as_dificuldades_e_pesa_a_precisao_pelas_notas() {
        let perfil = montar_perfil(
            conta(),
            dados(vec![
                estatisticas(Dificuldade::Expert, 2, 900, 1000, 80_000),
                estatisticas(Dificuldade::Facil, 3, 100, 100, 20_000),
            ]),
        );
        assert_eq!((perfil.partidas, perfil.derrotas), (5, 2));
        assert_eq!(perfil.melhor_pontuacao, 80_000);
        assert!((perfil.precisao - 1000.0 / 1100.0).abs() < 1e-9);
        assert_eq!(perfil.por_dificuldade[0].partidas, 3);
        assert_eq!(perfil.por_dificuldade[3].precisao(), 0.9);
        assert_eq!(perfil.musicas_distintas, 3);
    }

    #[test]
    fn instrumentos_vem_do_mais_jogado_para_o_menos_sem_os_zerados() {
        let no = |instrumento, partidas| PartidasNoInstrumento { instrumento, partidas };
        let mut entrada = dados(vec![]);
        entrada.por_instrumento = vec![no(Instrumento::Baixo, 2), no(Instrumento::Teclado, 0), no(Instrumento::Guitarra, 7)];
        let perfil = montar_perfil(conta(), entrada);
        assert_eq!(perfil.por_instrumento, [no(Instrumento::Guitarra, 7), no(Instrumento::Baixo, 2)]);
    }

    #[test]
    fn ids_das_musicas_juntam_as_listas_sem_repetir() {
        let mut entrada = dados(vec![]);
        let recente = |musica_id: &str| PartidaRecente {
            musica_id: musica_id.into(),
            dificuldade: Dificuldade::Facil,
            pontos: 0,
            acertos: 0,
            total: 0,
            derrota: false,
            jogada_em: DateTime::UNIX_EPOCH,
        };
        entrada.mais_tocadas = vec![MusicaMaisTocada {
            musica_id: "a".into(),
            partidas: 3,
        }];
        entrada.recentes = vec![recente("b"), recente("a"), recente("c")];
        assert_eq!(montar_perfil(conta(), entrada).ids_das_musicas(), ["a", "b", "c"]);
    }
}
