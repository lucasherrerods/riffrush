use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Como no osu!: o top da música, sem rolar uma lista infinita.
pub const TAMANHO_DO_TOP: u32 = 50;

/// A melhor partida de um jogador numa música e dificuldade, já com a posição dele.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinhaDoRanking {
    pub posicao: u32,
    /// Quantos jogadores têm recorde nesta música e dificuldade.
    pub jogadores: u32,
    pub conta_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub pontos: u64,
    pub acertos: u32,
    pub total: u32,
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

/// Uma música no ranking das mais jogadas, contando as partidas de todo mundo.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MusicaPopular {
    pub posicao: u32,
    pub musica_id: String,
    pub partidas: u32,
    /// Quantas contas diferentes jogaram.
    pub jogadores: u32,
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
pub fn montar_ranking<L: Posicionada>(linhas: Vec<L>, conta: Option<Uuid>) -> Ranking<L> {
    let jogadores = linhas.first().map_or(0, |l| l.jogadores());
    let meu = conta.and_then(|id| linhas.iter().find(|l| l.conta_id() == id).cloned());
    let top = linhas.into_iter().filter(|l| l.posicao() <= TAMANHO_DO_TOP).collect();
    Ranking { top, jogadores, meu }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn linha(posicao: u32, conta: u128) -> LinhaDoRanking {
        LinhaDoRanking {
            posicao,
            jogadores: 100,
            conta_id: Uuid::from_u128(conta),
            nome: format!("jogador {conta}"),
            avatar: None,
            pontos: 1000 - u64::from(posicao),
            acertos: 10,
            total: 10,
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
        let ranking = montar_ranking(vec![geral(1, 1), geral(120, 9)], Some(Uuid::from_u128(9)));
        assert_eq!(ranking.top.len(), 1);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(120));
        assert_eq!(ranking.jogadores, 300);
    }

    #[test]
    fn sem_recordes_o_ranking_fica_vazio() {
        assert_eq!(
            montar_ranking::<LinhaDoRanking>(vec![], Some(Uuid::nil())),
            Ranking {
                top: vec![],
                jogadores: 0,
                meu: None
            }
        );
    }

    #[test]
    fn quem_pediu_fora_do_top_aparece_so_como_meu() {
        let ranking = montar_ranking(vec![linha(1, 1), linha(2, 2), linha(78, 9)], Some(Uuid::from_u128(9)));
        assert_eq!(ranking.top.iter().map(|l| l.posicao).collect::<Vec<_>>(), [1, 2]);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(78));
        assert_eq!(ranking.jogadores, 100);
    }

    #[test]
    fn quem_pediu_dentro_do_top_aparece_nos_dois() {
        let ranking = montar_ranking(vec![linha(1, 1), linha(2, 2)], Some(Uuid::from_u128(2)));
        assert_eq!(ranking.top.len(), 2);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(2));
    }

    #[test]
    fn sem_sessao_nao_tem_meu() {
        assert_eq!(montar_ranking(vec![linha(1, 1)], None).meu, None);
    }
}
