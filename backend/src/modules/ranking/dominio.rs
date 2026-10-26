use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::modules::catalogo::DadosDaMusica;
use crate::modules::progresso::{Dificuldade, Instrumento};

/// O ranking geral e o das músicas mais jogadas, sem rolar uma lista infinita.
pub const TAMANHO_DO_TOP: u32 = 50;
/// O top de cada música, dificuldade e instrumento. Só ele guarda os replays.
pub const TAMANHO_DO_TOP_DA_MUSICA: u32 = 10;

/// A melhor partida de um jogador numa música e dificuldade, já com a posição dele.
#[derive(Debug, Clone, PartialEq)]
pub struct LinhaDoRanking {
    pub posicao: u32,
    /// Quantos jogadores têm recorde nesta música e dificuldade.
    pub jogadores: u32,
    pub conta_id: Uuid,
    /// A partida que deu o recorde, para abrir as estatísticas dela.
    pub partida_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub pontos: u64,
    pub acertos: u32,
    pub total: u32,
    /// De 0 a 1, pelo valor de cada nota. É o que ordena o ranking.
    pub precisao: f64,
    /// O desempate depois da precisão.
    pub maior_sequencia: Option<u32>,
    pub jogada_em: DateTime<Utc>,
}

/// Um jogador no ranking geral: a ordem é pelo XP total da conta.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinhaDoGeral {
    pub posicao: u32,
    /// Quantas contas já ganharam XP.
    pub jogadores: u32,
    pub conta_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub xp_total: u64,
}

/// Uma partida aberta pelo ranking: só o que a tela de resultado mostra, sem dados privados da conta.
#[derive(Debug, Clone, PartialEq)]
pub struct PartidaPublica {
    pub id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub musica_id: String,
    pub dificuldade: Dificuldade,
    pub instrumento: Instrumento,
    pub pontos: u64,
    pub acertos: u32,
    pub total: u32,
    /// Só as partidas que o servidor rejulgou têm.
    pub precisao: Option<f64>,
    /// Partidas de antes da coluna não têm.
    pub maior_sequencia: Option<u32>,
    pub derrota: bool,
    pub fantasma: bool,
    pub jogada_em: DateTime<Utc>,
    pub tem_replay: bool,
}

/// O que ordena o ranking de uma música.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Ordem {
    /// O padrão: a precisão, depois a maior sequência.
    #[default]
    Precisao,
    /// Os pontos, depois a precisão.
    Pontos,
}

/// O primeiro lugar de uma música, na dificuldade mais alta em que alguém terminou.
#[derive(Debug, Clone, PartialEq)]
pub struct RecordeDaMusica {
    pub nome: String,
    pub precisao: f64,
    pub dificuldade: Dificuldade,
}

impl RecordeDaMusica {
    /// Vale mais o da dificuldade mais alta; na mesma, o de mais precisão.
    fn supera(&self, outro: &Self) -> bool {
        (self.dificuldade, self.precisao) > (outro.dificuldade, outro.precisao)
    }
}

/// Uma música no ranking das mais jogadas, contando as partidas de todo mundo.
#[derive(Debug, Clone, PartialEq)]
pub struct MusicaPopular {
    pub posicao: u32,
    pub musica_id: String,
    pub partidas: u32,
    /// Quantas contas diferentes jogaram.
    pub jogadores: u32,
    /// Sem ele, ninguém terminou a música com a precisão conferida pelo servidor.
    pub recorde: Option<RecordeDaMusica>,
}

/// O que o ranking da música e o geral têm em comum para separar o top da linha de quem pediu.
pub trait Posicionada: Clone {
    fn posicao(&self) -> u32;
    fn jogadores(&self) -> u32;
    fn conta_id(&self) -> Uuid;
}

impl Posicionada for LinhaDoRanking {
    fn posicao(&self) -> u32 {
        self.posicao
    }
    fn jogadores(&self) -> u32 {
        self.jogadores
    }
    fn conta_id(&self) -> Uuid {
        self.conta_id
    }
}

impl Posicionada for LinhaDoGeral {
    fn posicao(&self) -> u32 {
        self.posicao
    }
    fn jogadores(&self) -> u32 {
        self.jogadores
    }
    fn conta_id(&self) -> Uuid {
        self.conta_id
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ranking<L = LinhaDoRanking> {
    pub top: Vec<L>,
    pub jogadores: u32,
    /// A linha de quem pediu, mesmo fora do top.
    pub meu: Option<L>,
}

/// O banco devolve o top e, se existir, a linha de quem pediu. Aqui cada uma vai para o seu lugar.
pub fn montar_ranking<L: Posicionada>(linhas: Vec<L>, conta: Option<Uuid>, tamanho: u32) -> Ranking<L> {
    let jogadores = linhas.first().map_or(0, |l| l.jogadores());
    let meu = conta.and_then(|id| linhas.iter().find(|l| l.conta_id() == id).cloned());
    let top = linhas.into_iter().filter(|l| l.posicao() <= tamanho).collect();
    Ranking { top, jogadores, meu }
}

fn normalizar(texto: &str) -> String {
    texto.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
}

/// Mesmo título e a mesma banda, aceitando que uma contenha a outra:
/// o Encore diz "Tom Rothrock with Jim Wise" onde o nome do arquivo dizia "Jim Wise".
fn mesma_musica(a: &DadosDaMusica, b: &DadosDaMusica) -> bool {
    let (Some(titulo_a), Some(titulo_b)) = (&a.titulo, &b.titulo) else {
        return false;
    };
    if normalizar(titulo_a) != normalizar(titulo_b) {
        return false;
    }
    match (&a.artista, &b.artista) {
        (Some(x), Some(y)) => {
            let (x, y) = (normalizar(x), normalizar(y));
            x.contains(&y) || y.contains(&x)
        }
        _ => true,
    }
}

/// Junta as linhas da mesma música com ids diferentes. Antes do id pelo md5, uma música importada
/// era registrada pelo nome do arquivo, e as partidas dela ficavam divididas entre os dois ids.
/// Soma as partidas; os jogadores ficam no maior dos dois, porque a mesma pessoa pode estar nos dois.
pub fn juntar_mesmas_musicas(musicas: Vec<(MusicaPopular, DadosDaMusica)>, tamanho: usize) -> Vec<(MusicaPopular, DadosDaMusica)> {
    let mut juntas: Vec<(MusicaPopular, DadosDaMusica)> = Vec::new();
    for (musica, dados) in musicas {
        match juntas.iter_mut().find(|(_, d)| mesma_musica(d, &dados)) {
            Some((junta, dados_da_junta)) => {
                junta.partidas += musica.partidas;
                junta.jogadores = junta.jogadores.max(musica.jogadores);
                if let Some(recorde) = &musica.recorde {
                    if junta.recorde.as_ref().is_none_or(|atual| recorde.supera(atual)) {
                        junta.recorde = Some(recorde.clone());
                    }
                }
                // Fica o id e os dados de quem tem capa (o do Encore).
                if dados_da_junta.capa.is_none() && dados.capa.is_some() {
                    junta.musica_id = musica.musica_id;
                    *dados_da_junta = dados;
                }
            }
            None => juntas.push((musica, dados)),
        }
    }
    juntas.sort_by(|(a, _), (b, _)| b.partidas.cmp(&a.partidas).then(b.jogadores.cmp(&a.jogadores)));
    juntas.truncate(tamanho);
    for (posicao, (musica, _)) in juntas.iter_mut().enumerate() {
        musica.posicao = u32::try_from(posicao + 1).unwrap_or(u32::MAX);
    }
    juntas
}

#[cfg(test)]
mod tests {
    use super::*;

    fn linha(posicao: u32, conta: u128) -> LinhaDoRanking {
        LinhaDoRanking {
            posicao,
            jogadores: 100,
            conta_id: Uuid::from_u128(conta),
            partida_id: Uuid::from_u128(conta),
            nome: format!("jogador {conta}"),
            avatar: None,
            pontos: 1000 - u64::from(posicao),
            acertos: 10,
            total: 10,
            precisao: 1.0,
            maior_sequencia: Some(10),
            jogada_em: DateTime::UNIX_EPOCH,
        }
    }

    #[test]
    fn o_geral_separa_o_top_e_quem_pediu_do_mesmo_jeito() {
        let geral = |posicao: u32, conta: u128| LinhaDoGeral {
            posicao,
            jogadores: 300,
            conta_id: Uuid::from_u128(conta),
            nome: "alguém".into(),
            avatar: None,
            xp_total: 10_000 - u64::from(posicao),
        };
        let ranking = montar_ranking(vec![geral(1, 1), geral(120, 9)], Some(Uuid::from_u128(9)), TAMANHO_DO_TOP);
        assert_eq!(ranking.top.len(), 1);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(120));
        assert_eq!(ranking.jogadores, 300);
    }

    #[test]
    fn sem_recordes_o_ranking_fica_vazio() {
        assert_eq!(
            montar_ranking::<LinhaDoRanking>(vec![], Some(Uuid::nil()), TAMANHO_DO_TOP_DA_MUSICA),
            Ranking {
                top: vec![],
                jogadores: 0,
                meu: None
            }
        );
    }

    #[test]
    fn quem_pediu_fora_do_top_aparece_so_como_meu() {
        let ranking = montar_ranking(vec![linha(1, 1), linha(2, 2), linha(78, 9)], Some(Uuid::from_u128(9)), TAMANHO_DO_TOP_DA_MUSICA);
        assert_eq!(ranking.top.iter().map(|l| l.posicao).collect::<Vec<_>>(), [1, 2]);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(78));
        assert_eq!(ranking.jogadores, 100);
    }

    #[test]
    fn quem_pediu_dentro_do_top_aparece_nos_dois() {
        let ranking = montar_ranking(vec![linha(1, 1), linha(2, 2)], Some(Uuid::from_u128(2)), TAMANHO_DO_TOP_DA_MUSICA);
        assert_eq!(ranking.top.len(), 2);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(2));
    }

    #[test]
    fn sem_sessao_nao_tem_meu() {
        assert_eq!(montar_ranking(vec![linha(1, 1)], None, TAMANHO_DO_TOP_DA_MUSICA).meu, None);
    }

    fn popular(musica_id: &str, partidas: u32, jogadores: u32) -> MusicaPopular {
        MusicaPopular {
            posicao: 0,
            musica_id: musica_id.into(),
            partidas,
            jogadores,
            recorde: None,
        }
    }

    fn recorde(nome: &str, precisao: f64, dificuldade: Dificuldade) -> Option<RecordeDaMusica> {
        Some(RecordeDaMusica {
            nome: nome.into(),
            precisao,
            dificuldade,
        })
    }

    #[test]
    fn ao_juntar_fica_o_recorde_da_dificuldade_mais_alta() {
        let musicas = vec![
            (
                MusicaPopular {
                    recorde: recorde("ana", 0.99, Dificuldade::Dificil),
                    ..popular("arquivo:x", 2, 2)
                },
                dados("Crazy", "Aerosmith", None),
            ),
            (
                MusicaPopular {
                    recorde: recorde("bia", 0.7, Dificuldade::Expert),
                    ..popular("encore:x", 1, 1)
                },
                dados("Crazy", "Aerosmith", Some("capa.jpg")),
            ),
            (popular("arquivo:y", 1, 1), dados("Crazy", "Gnarls Barkley", None)),
            (
                MusicaPopular {
                    recorde: recorde("caio", 0.8, Dificuldade::Facil),
                    ..popular("encore:y", 1, 1)
                },
                dados("Crazy", "Gnarls Barkley", Some("capa.jpg")),
            ),
        ];

        let juntas = juntar_mesmas_musicas(musicas, 50);

        let recordes: Vec<_> = juntas.iter().map(|(m, _)| m.recorde.as_ref().map(|r| r.nome.as_str())).collect();
        assert_eq!(recordes, [Some("bia"), Some("caio")]);
    }

    #[test]
    fn na_mesma_dificuldade_o_recorde_e_o_de_mais_precisao() {
        let a = recorde("a", 0.9, Dificuldade::Expert).unwrap();
        let b = recorde("b", 0.95, Dificuldade::Expert).unwrap();
        assert!(b.supera(&a));
        assert!(!a.supera(&b));
    }

    fn dados(titulo: &str, artista: &str, capa: Option<&str>) -> DadosDaMusica {
        DadosDaMusica {
            titulo: Some(titulo.into()),
            artista: Some(artista.into()),
            capa: capa.map(Into::into),
        }
    }

    #[test]
    fn junta_o_arquivo_antigo_com_o_encore_da_mesma_musica() {
        let musicas = vec![
            (popular("spektrem-shine", 16, 6), DadosDaMusica::default()),
            (
                popular("arquivo:Jim Wise - Goofy Goober Rock.sng:1", 3, 3),
                dados("Goofy Goober Rock", "Jim Wise", None),
            ),
            (
                popular("encore:fb00", 3, 1),
                dados("goofy  goober rock", "Tom Rothrock with Jim Wise", Some("capa.jpg")),
            ),
            (popular("arquivo:Rush - Tom Sawyer.sng:1", 2, 2), dados("Tom Sawyer", "Rush", None)),
        ];

        let juntas = juntar_mesmas_musicas(musicas, 50);

        let resumo: Vec<_> = juntas.iter().map(|(m, _)| (m.posicao, m.musica_id.as_str(), m.partidas, m.jogadores)).collect();
        assert_eq!(
            resumo,
            [
                (1, "spektrem-shine", 16, 6),
                (2, "encore:fb00", 6, 3),
                (3, "arquivo:Rush - Tom Sawyer.sng:1", 2, 2)
            ]
        );
        assert_eq!(juntas[1].1.capa.as_deref(), Some("capa.jpg"));
    }

    #[test]
    fn mesmo_titulo_de_bandas_diferentes_e_sem_nome_ficam_separados() {
        let musicas = vec![
            (popular("a", 2, 2), dados("Crazy", "Aerosmith", None)),
            (popular("b", 1, 1), dados("Crazy", "Gnarls Barkley", None)),
            (popular("c", 1, 1), DadosDaMusica::default()),
            (popular("d", 1, 1), DadosDaMusica::default()),
        ];
        assert_eq!(juntar_mesmas_musicas(musicas, 50).len(), 4);
    }

    #[test]
    fn corta_no_tamanho_depois_de_juntar() {
        let musicas = (0..5).map(|i| (popular(&format!("m{i}"), 5 - i, 1), DadosDaMusica::default())).collect();
        assert_eq!(juntar_mesmas_musicas(musicas, 2).len(), 2);
    }
}
