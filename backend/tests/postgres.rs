//! O adaptador do Postgres contra um banco de verdade. Roda quando há `DATABASE_URL`
//! (o CI sobe um Postgres); sem ela, os testes passam sem fazer nada.

use chrono::{Duration, Utc};
use riffrush_api::modules::conta::{ContasPostgres, PartidaRegistrada, PerfilDoGoogle, RepositorioDeContas, RepositorioDeSessoes};
use riffrush_api::modules::perfil::{PerfilPostgres, RepositorioDoPerfil};
use riffrush_api::modules::progresso::{Dificuldade, Instrumento, ResumoDaPartida};
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
        email: Some("lucas@exemplo.com".into()),
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
async fn login_sem_email_mantem_o_que_ja_estava_guardado() {
    let Some(banco) = banco().await else { return };
    let mut pessoa = perfil();
    let criada = banco.entrar(&pessoa, Uuid::new_v4()).await.unwrap();
    assert_eq!(criada.email.as_deref(), Some("lucas@exemplo.com"));
    pessoa.email = None;
    let de_novo = banco.entrar(&pessoa, Uuid::new_v4()).await.unwrap();
    assert_eq!(de_novo.email.as_deref(), Some("lucas@exemplo.com"));
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
        instrumento: Instrumento::Guitarra,
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
        instrumento: Instrumento::Guitarra,
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
        instrumento: Instrumento::Guitarra,
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
        // No baixo é outro ranking: não entra no da guitarra.
        PartidaRegistrada {
            instrumento: Instrumento::Baixo,
            ..jogar(caio.id, 9999, false, 5)
        },
    ] {
        banco.registrar_partida(&partida).await.unwrap();
    }

    let linhas = ranking
        .linhas(&musica, Dificuldade::Expert, Instrumento::Guitarra, 2, Some(caio.id))
        .await
        .unwrap();

    let resumo: Vec<_> = linhas.iter().map(|l| (l.posicao, l.conta_id, l.pontos, l.jogadores)).collect();
    assert_eq!(resumo, [(1, ana.id, 900, 3), (2, bia.id, 700, 3), (3, caio.id, 100, 3)]);
    assert!(ranking
        .linhas(&musica, Dificuldade::Facil, Instrumento::Guitarra, 50, None)
        .await
        .unwrap()
        .is_empty());
    let baixo = ranking.linhas(&musica, Dificuldade::Expert, Instrumento::Baixo, 50, None).await.unwrap();
    assert_eq!(baixo.iter().map(|l| (l.conta_id, l.pontos)).collect::<Vec<_>>(), [(caio.id, 9999)]);
}

#[tokio::test]
async fn perfil_soma_por_dificuldade_e_traz_as_ultimas_partidas() {
    let Some(banco) = banco().await else { return };
    let repositorio = PerfilPostgres(banco.0.clone());
    let conta = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let agora = Utc::now();
    let jogar = |musica: &str, dificuldade: Dificuldade, pontos: u64, derrota: bool, segundos: i64| PartidaRegistrada {
        conta_id: conta.id,
        musica_id: musica.into(),
        instrumento: Instrumento::Guitarra,
        pontos,
        resumo: ResumoDaPartida {
            dificuldade,
            acertos: 8,
            total: 10,
            derrota,
            fantasma: false,
        },
        xp_ganho: 0,
        jogada_em: agora + Duration::seconds(segundos),
    };
    for partida in [
        jogar("a", Dificuldade::Expert, 900, false, 0),
        // Vaiada conta como partida, mas não como melhor pontuação.
        jogar("a", Dificuldade::Expert, 5000, true, 1),
        jogar("b", Dificuldade::Facil, 300, false, 2),
    ] {
        banco.registrar_partida(&partida).await.unwrap();
    }

    let dados = repositorio.dados(conta.id, 2).await.unwrap().unwrap();

    assert_eq!(dados.musicas_distintas, 2);
    let expert = dados.por_dificuldade.iter().find(|e| e.dificuldade == Dificuldade::Expert).unwrap();
    assert_eq!(
        (expert.partidas, expert.derrotas, expert.acertos, expert.notas, expert.melhor_pontuacao),
        (2, 1, 16, 20, 900)
    );
    let recentes: Vec<_> = dados.recentes.iter().map(|p| p.musica_id.as_str()).collect();
    assert_eq!(recentes, ["b", "a"]);
    let instrumentos: Vec<_> = dados.por_instrumento.iter().map(|i| (i.instrumento, i.partidas)).collect();
    assert_eq!(instrumentos, [(Instrumento::Guitarra, 3)]);
    let mais_tocadas: Vec<_> = dados.mais_tocadas.iter().map(|m| (m.musica_id.as_str(), m.partidas)).collect();
    assert_eq!(mais_tocadas, [("a", 2), ("b", 1)]);
    assert!(repositorio.dados(Uuid::new_v4(), 10).await.unwrap().is_none());
}

#[tokio::test]
async fn ranking_geral_ordena_por_xp_e_ignora_quem_nao_jogou() {
    let Some(banco) = banco().await else { return };
    let ranking = RankingPostgres(banco.0.clone());
    let sem_xp = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let jogador = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    banco
        .registrar_partida(&PartidaRegistrada {
            conta_id: jogador.id,
            musica_id: "teste:geral".into(),
            instrumento: Instrumento::Guitarra,
            pontos: 10,
            resumo: ResumoDaPartida {
                dificuldade: Dificuldade::Facil,
                acertos: 1,
                total: 1,
                derrota: false,
                fantasma: false,
            },
            xp_ganho: 1_000_000_000,
            jogada_em: Utc::now(),
        })
        .await
        .unwrap();

    let linhas = ranking.geral(1, Some(sem_xp.id)).await.unwrap();

    // Com um XP tão alto, este jogador é o primeiro mesmo com outras contas no banco.
    assert_eq!(linhas.iter().map(|l| (l.posicao, l.conta_id)).collect::<Vec<_>>(), [(1, jogador.id)]);
}

#[tokio::test]
async fn musicas_mais_jogadas_contam_partidas_e_jogadores_diferentes() {
    let Some(banco) = banco().await else { return };
    let ranking = RankingPostgres(banco.0.clone());
    // Música só deste teste, com partidas suficientes para ficar no topo do banco de testes.
    let musica = format!("teste:{}", Uuid::new_v4());
    let ana = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let bia = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let agora = Utc::now();
    for (i, conta) in [ana.id, ana.id, bia.id].into_iter().cycle().take(300).enumerate() {
        banco
            .registrar_partida(&PartidaRegistrada {
                conta_id: conta,
                musica_id: musica.clone(),
                instrumento: Instrumento::Guitarra,
                pontos: 10,
                resumo: ResumoDaPartida {
                    dificuldade: Dificuldade::Facil,
                    acertos: 1,
                    total: 1,
                    derrota: false,
                    fantasma: false,
                },
                xp_ganho: 0,
                jogada_em: agora + Duration::seconds(i as i64),
            })
            .await
            .unwrap();
    }

    let musicas = ranking.musicas(1).await.unwrap();

    assert_eq!(musicas.len(), 1);
    assert_eq!(
        (musicas[0].posicao, musicas[0].musica_id.as_str(), musicas[0].partidas, musicas[0].jogadores),
        (1, musica.as_str(), 300, 2)
    );
}

#[tokio::test]
async fn ranking_geral_da_a_posicao_certa_fora_do_top_e_no_empate() {
    let Some(banco) = banco().await else { return };
    let ranking = RankingPostgres(banco.0.clone());
    let partida = |conta_id, xp_ganho| PartidaRegistrada {
        conta_id,
        musica_id: "teste:geral".into(),
        instrumento: Instrumento::Guitarra,
        pontos: 10,
        resumo: ResumoDaPartida {
            dificuldade: Dificuldade::Facil,
            acertos: 1,
            total: 1,
            derrota: false,
            fantasma: false,
        },
        xp_ganho,
        jogada_em: Utc::now(),
    };
    let primeiro = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let empatado = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    banco.registrar_partida(&partida(primeiro.id, 7)).await.unwrap();
    banco.registrar_partida(&partida(empatado.id, 7)).await.unwrap();

    let linhas = ranking.geral(1, Some(empatado.id)).await.unwrap();

    // A posição tem que bater com a numeração de todas as contas.
    let (esperada, jogadores): (i64, i64) = sqlx::query_as(
        "SELECT posicao, jogadores FROM (
             SELECT id, ROW_NUMBER() OVER (ORDER BY xp_total DESC, criada_em ASC) AS posicao, COUNT(*) OVER () AS jogadores
             FROM contas WHERE xp_total > 0
         ) n WHERE id = $1",
    )
    .bind(empatado.id)
    .fetch_one(&banco.0)
    .await
    .unwrap();
    let minha = linhas.iter().find(|l| l.conta_id == empatado.id).unwrap();
    assert_eq!((i64::from(minha.posicao), i64::from(minha.jogadores)), (esperada, jogadores));
    assert_eq!(linhas[0].posicao, 1);
}
