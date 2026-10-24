use std::sync::Arc;

use super::dominio::{montar_ranking, Ranking, TAMANHO_DO_TOP};
use super::portas::RepositorioDoRanking;
use crate::modules::conta::{FalhaExterna, ServicosDaConta, TAMANHO_MAXIMO_DO_ID_DA_MUSICA};
use crate::modules::progresso::{Dificuldade, Instrumento};

#[derive(Clone)]
pub struct ServicosDoRanking {
    pub repositorio: Arc<dyn RepositorioDoRanking>,
    /// Para achar a conta de quem pediu e mostrar o recorde dela.
    pub conta: ServicosDaConta,
}

#[derive(Debug, thiserror::Error)]
pub enum ErroDoRanking {
    #[error("o id da música é inválido")]
    MusicaInvalida,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl ServicosDoRanking {
    pub async fn ranking(&self, musica_id: &str, dificuldade: Dificuldade, instrumento: Instrumento, token: Option<&str>) -> Result<Ranking, ErroDoRanking> {
        if musica_id.is_empty() || musica_id.len() > TAMANHO_MAXIMO_DO_ID_DA_MUSICA {
            return Err(ErroDoRanking::MusicaInvalida);
        }
        // Sessão vencida ou inválida não esconde o ranking: só fica sem o recorde pessoal.
        let conta = match token {
            Some(token) => self.conta.conta_da_sessao(token).await.ok().map(|c| c.id),
            None => None,
        };
        let linhas = self.repositorio.linhas(musica_id, dificuldade, instrumento, TAMANHO_DO_TOP, conta).await?;
        Ok(montar_ranking(linhas, conta))
    }
}

/// Fake do repositório, para os testes daqui e os de integração (feature `testes`).
#[cfg(any(test, feature = "testes"))]
pub mod fakes {
    use std::sync::Mutex;

    use async_trait::async_trait;
    use uuid::Uuid;

    use super::*;
    use crate::modules::ranking::dominio::LinhaDoRanking;

    /// Devolve as linhas guardadas que batem com o pedido.
    #[derive(Default)]
    pub struct RankingEmMemoria {
        pub linhas: Mutex<Vec<(String, Dificuldade, Instrumento, LinhaDoRanking)>>,
        /// O limite do último pedido, para conferir que o caso de uso pede o top inteiro.
        pub ultimo_limite: Mutex<Option<u32>>,
    }

    /// O ranking ligado a um repositório em memória, que o teste preenche.
    pub fn servicos_do_ranking(conta: ServicosDaConta) -> (ServicosDoRanking, Arc<RankingEmMemoria>) {
        let repositorio = Arc::new(RankingEmMemoria::default());
        let servicos = ServicosDoRanking {
            repositorio: repositorio.clone(),
            conta,
        };
        (servicos, repositorio)
    }

    #[async_trait]
    impl RepositorioDoRanking for RankingEmMemoria {
        async fn linhas(
            &self,
            musica_id: &str,
            dificuldade: Dificuldade,
            instrumento: Instrumento,
            ate: u32,
            conta: Option<Uuid>,
        ) -> Result<Vec<LinhaDoRanking>, FalhaExterna> {
            *self.ultimo_limite.lock().unwrap() = Some(ate);
            Ok(self
                .linhas
                .lock()
                .unwrap()
                .iter()
                .filter(|(m, d, i, l)| m == musica_id && *d == dificuldade && *i == instrumento && (l.posicao <= ate || Some(l.conta_id) == conta))
                .map(|(_, _, _, l)| l.clone())
                .collect())
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;
    use uuid::Uuid;

    use super::fakes::{servicos_do_ranking, RankingEmMemoria};
    use super::*;
    use crate::modules::conta::fakes::{pedido, servicos};
    use crate::modules::ranking::dominio::LinhaDoRanking;

    fn linha(posicao: u32, conta_id: Uuid) -> LinhaDoRanking {
        LinhaDoRanking {
            posicao,
            jogadores: 60,
            conta_id,
            nome: "alguém".into(),
            avatar: None,
            pontos: 1000,
            acertos: 9,
            total: 10,
            jogada_em: DateTime::UNIX_EPOCH,
        }
    }

    fn ranking_com(conta: ServicosDaConta, linhas: Vec<LinhaDoRanking>) -> (ServicosDoRanking, Arc<RankingEmMemoria>) {
        let (servicos, repositorio) = servicos_do_ranking(conta);
        *repositorio.linhas.lock().unwrap() = linhas
            .into_iter()
            .map(|l| ("encore:abc".to_string(), Dificuldade::Expert, Instrumento::Guitarra, l))
            .collect();
        (servicos, repositorio)
    }

    #[tokio::test]
    async fn sem_login_mostra_so_o_top() {
        let (servicos, repositorio) = ranking_com(servicos().0, vec![linha(1, Uuid::from_u128(1))]);
        let ranking = servicos.ranking("encore:abc", Dificuldade::Expert, Instrumento::Guitarra, None).await.unwrap();
        assert_eq!(ranking.top.len(), 1);
        assert_eq!(ranking.meu, None);
        assert_eq!(*repositorio.ultimo_limite.lock().unwrap(), Some(TAMANHO_DO_TOP));
    }

    #[tokio::test]
    async fn logado_mostra_o_proprio_recorde_fora_do_top() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, _) = ranking_com(conta, vec![linha(1, Uuid::from_u128(77)), linha(578, entrada.conta.id)]);
        let ranking = servicos
            .ranking("encore:abc", Dificuldade::Expert, Instrumento::Guitarra, Some(&entrada.token))
            .await
            .unwrap();
        assert_eq!(ranking.top.len(), 1);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(578));
    }

    #[tokio::test]
    async fn sessao_invalida_nao_derruba_o_ranking() {
        let (servicos, _) = ranking_com(servicos().0, vec![linha(1, Uuid::from_u128(1))]);
        let ranking = servicos
            .ranking("encore:abc", Dificuldade::Expert, Instrumento::Guitarra, Some("inventado"))
            .await
            .unwrap();
        assert_eq!((ranking.top.len(), ranking.meu), (1, None));
    }

    #[tokio::test]
    async fn id_de_musica_vazio_ou_grande_demais_e_recusado() {
        let (servicos, _) = ranking_com(servicos().0, vec![]);
        assert!(matches!(
            servicos.ranking("", Dificuldade::Medio, Instrumento::Guitarra, None).await,
            Err(ErroDoRanking::MusicaInvalida)
        ));
        let enorme = "x".repeat(TAMANHO_MAXIMO_DO_ID_DA_MUSICA + 1);
        assert!(matches!(
            servicos.ranking(&enorme, Dificuldade::Medio, Instrumento::Guitarra, None).await,
            Err(ErroDoRanking::MusicaInvalida)
        ));
    }
}
