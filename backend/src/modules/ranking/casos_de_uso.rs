use std::sync::Arc;

use super::dominio::{montar_ranking, LinhaDoGeral, MusicaPopular, PartidaPublica, Ranking, TAMANHO_DO_TOP};
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
    #[error("a partida não existe")]
    PartidaNaoEncontrada,
    #[error(transparent)]
    Falha(#[from] FalhaExterna),
}

impl ServicosDoRanking {
    pub async fn ranking(&self, musica_id: &str, dificuldade: Dificuldade, instrumento: Instrumento, token: Option<&str>) -> Result<Ranking, ErroDoRanking> {
        if musica_id.is_empty() || musica_id.len() > TAMANHO_MAXIMO_DO_ID_DA_MUSICA {
            return Err(ErroDoRanking::MusicaInvalida);
        }
        let conta = self.conta_de(token).await;
        let linhas = self.repositorio.linhas(musica_id, dificuldade, instrumento, TAMANHO_DO_TOP, conta).await?;
        Ok(montar_ranking(linhas, conta))
    }

    /// Os jogadores com mais XP. Com o token, vem também a posição de quem pediu.
    pub async fn geral(&self, token: Option<&str>) -> Result<Ranking<LinhaDoGeral>, ErroDoRanking> {
        let conta = self.conta_de(token).await;
        let linhas = self.repositorio.geral(TAMANHO_DO_TOP, conta).await?;
        Ok(montar_ranking(linhas, conta))
    }

    /// As músicas com mais partidas, somando todos os jogadores.
    pub async fn musicas(&self) -> Result<Vec<MusicaPopular>, ErroDoRanking> {
        Ok(self.repositorio.musicas(TAMANHO_DO_TOP).await?)
    }

    /// A partida que alguém abriu no ranking. É pública, como o próprio ranking.
    pub async fn partida(&self, id: uuid::Uuid) -> Result<PartidaPublica, ErroDoRanking> {
        self.repositorio.partida(id).await?.ok_or(ErroDoRanking::PartidaNaoEncontrada)
    }

    /// O replay da partida, para assistir no app. Também é público.
    pub async fn replay(&self, id: uuid::Uuid) -> Result<Vec<u8>, ErroDoRanking> {
        self.repositorio.replay(id).await?.ok_or(ErroDoRanking::PartidaNaoEncontrada)
    }

    /// Sessão vencida ou inválida não esconde o ranking: só fica sem a linha pessoal.
    async fn conta_de(&self, token: Option<&str>) -> Option<uuid::Uuid> {
        match token {
            Some(token) => self.conta.conta_da_sessao(token).await.ok().map(|c| c.id),
            None => None,
        }
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
        pub geral: Mutex<Vec<LinhaDoGeral>>,
        pub musicas: Mutex<Vec<MusicaPopular>>,
        pub partidas: Mutex<Vec<PartidaPublica>>,
        pub replays: Mutex<Vec<(Uuid, Vec<u8>)>>,
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

        async fn geral(&self, ate: u32, conta: Option<Uuid>) -> Result<Vec<LinhaDoGeral>, FalhaExterna> {
            *self.ultimo_limite.lock().unwrap() = Some(ate);
            Ok(self
                .geral
                .lock()
                .unwrap()
                .iter()
                .filter(|l| l.posicao <= ate || Some(l.conta_id) == conta)
                .cloned()
                .collect())
        }

        async fn musicas(&self, ate: u32) -> Result<Vec<MusicaPopular>, FalhaExterna> {
            *self.ultimo_limite.lock().unwrap() = Some(ate);
            Ok(self.musicas.lock().unwrap().iter().filter(|m| m.posicao <= ate).cloned().collect())
        }

        async fn partida(&self, id: Uuid) -> Result<Option<PartidaPublica>, FalhaExterna> {
            Ok(self.partidas.lock().unwrap().iter().find(|p| p.id == id).cloned())
        }

        async fn replay(&self, id: Uuid) -> Result<Option<Vec<u8>>, FalhaExterna> {
            Ok(self.replays.lock().unwrap().iter().find(|(p, _)| *p == id).map(|(_, r)| r.clone()))
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
            partida_id: Uuid::nil(),
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

    #[tokio::test]
    async fn geral_logado_traz_a_propria_posicao() {
        let conta = servicos().0;
        let entrada = conta.entrar_com_google(&pedido("bom")).await.unwrap();
        let (servicos, repositorio) = servicos_do_ranking(conta);
        let geral = |posicao, conta_id| LinhaDoGeral {
            posicao,
            jogadores: 80,
            conta_id,
            nome: "alguém".into(),
            avatar: None,
            xp_total: 500,
        };
        *repositorio.geral.lock().unwrap() = vec![geral(1, Uuid::from_u128(5)), geral(77, entrada.conta.id)];

        let ranking = servicos.geral(Some(&entrada.token)).await.unwrap();

        assert_eq!(ranking.top.len(), 1);
        assert_eq!(ranking.meu.map(|l| l.posicao), Some(77));
        assert_eq!(*repositorio.ultimo_limite.lock().unwrap(), Some(TAMANHO_DO_TOP));
        assert_eq!(servicos.geral(None).await.unwrap().meu, None);
    }

    #[tokio::test]
    async fn as_musicas_mais_jogadas_pedem_o_top_inteiro() {
        let (servicos, repositorio) = servicos_do_ranking(servicos().0);
        *repositorio.musicas.lock().unwrap() = vec![MusicaPopular {
            posicao: 1,
            musica_id: "encore:abc".into(),
            partidas: 30,
            jogadores: 4,
        }];
        assert_eq!(servicos.musicas().await.unwrap().len(), 1);
        assert_eq!(*repositorio.ultimo_limite.lock().unwrap(), Some(TAMANHO_DO_TOP));
    }

    #[tokio::test]
    async fn partida_que_nao_existe_e_nao_encontrada() {
        let (servicos, _) = servicos_do_ranking(servicos().0);
        assert!(matches!(servicos.partida(Uuid::nil()).await, Err(ErroDoRanking::PartidaNaoEncontrada)));
    }
}
