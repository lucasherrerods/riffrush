//! O adaptador do Postgres contra um banco de verdade. Roda quando há `DATABASE_URL`
//! (o CI sobe um Postgres); sem ela, os testes passam sem fazer nada.

use chrono::{Duration, Utc};
use riffrush_api::modules::conta::{ContasPostgres, PartidaRegistrada, PerfilDoGoogle, RepositorioDeContas, RepositorioDeSessoes};
use riffrush_api::modules::progresso::{Dificuldade, ResumoDaPartida};
use riffrush_api::modules::ranking::{RankingPostgres, RepositorioDoRanking};
use sqlx::PgPool;
use uuid::Uuid;

async fn banco() -> Option<ContasPostgres> {
    let url = std::env::var("DATABASE_URL").ok()?;
    let pool = PgPool::connect(&url).await.expect("o DATABASE_URL não conecta");
    sqlx::migrate!("./migrations").run(&pool).await.expect("as migrações falharam");
    Some(ContasPostgres(pool))
}

/// Cada teste usa uma pessoa nova, para rodarem juntos no mesmo banco.
fn perfil() -> PerfilDoGoogle {
    PerfilDoGoogle {
        sub: Uuid::new_v4().to_string(),
        nome: "Lucas".into(),
        avatar: None,
    }
}

#[tokio::test]
async fn entrar_cria_uma_vez_e_atualiza_o_nome() {
    let Some(banco) = banco().await else { return };
    let mut pessoa = perfil();
    let criada = banco.entrar(&pessoa, Uuid::new_v4()).await.unwrap();
    pessoa.nome = "Lucas H".into();
    let de_novo = banco.entrar(&pessoa, Uuid::new_v4()).await.unwrap();
    assert_eq!(criada.id, de_novo.id);
    assert_eq!(de_novo.nome, "Lucas H");
    assert_eq!(banco.buscar(criada.id).await.unwrap(), Some(de_novo));
}

#[tokio::test]
async fn sessao_vale_ate_expirar_e_some_ao_apagar() {
    let Some(banco) = banco().await else { return };
    let conta = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let hash = Uuid::new_v4().to_string();
    let agora = Utc::now();
    banco.criar(&hash, conta.id, agora + Duration::days(1)).await.unwrap();
    assert_eq!(banco.conta_da_sessao(&hash, agora).await.unwrap(), Some(conta.id));
    assert_eq!(banco.conta_da_sessao(&hash, agora + Duration::days(2)).await.unwrap(), None);
    banco.apagar(&hash).await.unwrap();
    assert_eq!(banco.conta_da_sessao(&hash, agora).await.unwrap(), None);
}

#[tokio::test]
async fn partida_soma_xp_e_marca_a_ultima() {
    let Some(banco) = banco().await else { return };
    let conta = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    assert_eq!(banco.ultima_partida(conta.id).await.unwrap(), None);
    let jogada_em = Utc::now();
    let partida = PartidaRegistrada {
        conta_id: conta.id,
        musica_id: "embutida:neon".into(),
        pontos: 1000,
        resumo: ResumoDaPartida {
            dificuldade: Dificuldade::Expert,
            acertos: 10,
            total: 10,
            derrota: false,
            fantasma: false,
        },
        xp_ganho: 120,
        jogada_em,
    };
    assert_eq!(banco.registrar_partida(&partida).await.unwrap().xp_total, 120);
    assert_eq!(banco.registrar_partida(&partida).await.unwrap().xp_total, 240);
    let ultima = banco.ultima_partida(conta.id).await.unwrap().unwrap();
    assert!((ultima - jogada_em).num_milliseconds().abs() < 1);
}

#[tokio::test]
async fn excluir_apaga_a_conta_com_sessoes_e_partidas() {
    let Some(banco) = banco().await else { return };
    let conta = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let hash = Uuid::new_v4().to_string();
    let agora = Utc::now();
    banco.criar(&hash, conta.id, agora + Duration::days(1)).await.unwrap();
    let partida = PartidaRegistrada {
        conta_id: conta.id,
        musica_id: "embutida:neon".into(),
        pontos: 1,
        resumo: ResumoDaPartida {
            dificuldade: Dificuldade::Facil,
            acertos: 1,
            total: 1,
            derrota: false,
            fantasma: false,
        },
        xp_ganho: 10,
        jogada_em: agora,
    };
    banco.registrar_partida(&partida).await.unwrap();

    banco.excluir(conta.id).await.unwrap();

    assert_eq!(banco.buscar(conta.id).await.unwrap(), None);
    assert_eq!(banco.conta_da_sessao(&hash, agora).await.unwrap(), None);
    assert_eq!(banco.ultima_partida(conta.id).await.unwrap(), None);
}

#[tokio::test]
async fn ranking_pega_a_melhor_partida_terminada_de_cada_jogador() {
    let Some(banco) = banco().await else { return };
    let ranking = RankingPostgres(banco.0.clone());
    // Música só deste teste, para não se misturar com as outras partidas do banco.
    let musica = format!("teste:{}", Uuid::new_v4());
    let agora = Utc::now();
    let jogar = |conta_id: Uuid, pontos: u64, derrota: bool, segundos: i64| PartidaRegistrada {
        conta_id,
        musica_id: musica.clone(),
        pontos,
        resumo: ResumoDaPartida {
            dificuldade: Dificuldade::Expert,
            acertos: 9,
            total: 10,
            derrota,
            fantasma: false,
        },
        xp_ganho: 0,
        jogada_em: agora + Duration::seconds(segundos),
    };
    let ana = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let bia = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let caio = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    for partida in [
        jogar(ana.id, 500, false, 0),
        jogar(ana.id, 900, false, 1),
        // Vaiada não conta, mesmo com mais pontos.
        jogar(bia.id, 5000, true, 2),
        jogar(bia.id, 700, false, 3),
        jogar(caio.id, 100, false, 4),
    ] {
        banco.registrar_partida(&partida).await.unwrap();
    }

    let linhas = ranking.linhas(&musica, Dificuldade::Expert, 2, Some(caio.id)).await.unwrap();

    let resumo: Vec<_> = linhas.iter().map(|l| (l.posicao, l.conta_id, l.pontos, l.jogadores)).collect();
    assert_eq!(resumo, [(1, ana.id, 900, 3), (2, bia.id, 700, 3), (3, caio.id, 100, 3)]);
    assert!(ranking.linhas(&musica, Dificuldade::Facil, 50, None).await.unwrap().is_empty());
}
