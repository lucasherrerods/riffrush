//! O adaptador do Postgres contra um banco de verdade. Roda quando há `DATABASE_URL`
//! (o CI sobe um Postgres); sem ela, os testes passam sem fazer nada.

use chrono::{Duration, Utc};
use riffrush_api::modules::catalogo::{CatalogoPostgres, DadosDaMusica, RepositorioDoCatalogo};
use riffrush_api::modules::conta::{
    ContasPostgres, FilaDePartidas, PartidaNaFila, PartidaRegistrada, PerfilDoGoogle, RepositorioDeContas, RepositorioDeSessoes,
};
use riffrush_api::modules::moderacao::{Denuncia, ModeracaoPostgres, RepositorioDeModeracao, Situacao};
use riffrush_api::modules::perfil::{PerfilPostgres, RepositorioDoPerfil};
use riffrush_api::modules::progresso::{Dificuldade, Instrumento, ResumoDaPartida};
use riffrush_api::modules::ranking::{RankingPostgres, RepositorioDoRanking};
use riffrush_api::modules::rejulgamento::{CacheDeCharts, ChartGuardado, FilaDoRejulgamento, RejulgamentoPostgres};
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
        id: Uuid::new_v4(),
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
            maior_sequencia: None,
        },
        xp_ganho: 120,
        jogada_em,
        replay: None,
    };
    assert_eq!(banco.registrar_partida(&partida).await.unwrap().xp_total, 120);
    // A fila pode entregar a mesma partida duas vezes: o mesmo id não soma de novo.
    assert_eq!(banco.registrar_partida(&partida).await.unwrap().xp_total, 120);
    let outra = PartidaRegistrada { id: Uuid::new_v4(), ..partida };
    assert_eq!(banco.registrar_partida(&outra).await.unwrap().xp_total, 240);
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
        id: Uuid::new_v4(),
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
            maior_sequencia: None,
        },
        xp_ganho: 10,
        jogada_em: agora,
        replay: None,
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
        id: Uuid::new_v4(),
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
            maior_sequencia: None,
        },
        xp_ganho: 0,
        jogada_em: agora + Duration::seconds(segundos),
        replay: None,
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
            id: Uuid::new_v4(),
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
        id: Uuid::new_v4(),
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
            maior_sequencia: None,
        },
        xp_ganho: 0,
        jogada_em: agora + Duration::seconds(segundos),
        replay: None,
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
            id: Uuid::new_v4(),
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
                maior_sequencia: None,
            },
            xp_ganho: 1_000_000_000,
            jogada_em: Utc::now(),
            replay: None,
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
                id: Uuid::new_v4(),
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
                    maior_sequencia: None,
                },
                xp_ganho: 0,
                jogada_em: agora + Duration::seconds(i as i64),
                replay: None,
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
        id: Uuid::new_v4(),
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
            maior_sequencia: None,
        },
        xp_ganho,
        jogada_em: Utc::now(),
        replay: None,
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

#[tokio::test]
async fn a_linha_do_ranking_abre_a_partida_com_a_maior_sequencia() {
    let Some(banco) = banco().await else { return };
    let ranking = RankingPostgres(banco.0.clone());
    let musica = format!("teste:{}", Uuid::new_v4());
    let jogador = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    banco
        .registrar_partida(&PartidaRegistrada {
            id: Uuid::new_v4(),
            conta_id: jogador.id,
            musica_id: musica.clone(),
            instrumento: Instrumento::Baixo,
            pontos: 500,
            resumo: ResumoDaPartida {
                dificuldade: Dificuldade::Dificil,
                acertos: 9,
                total: 10,
                derrota: false,
                fantasma: false,
                maior_sequencia: Some(6),
            },
            xp_ganho: 0,
            jogada_em: Utc::now(),
            replay: None,
        })
        .await
        .unwrap();

    let linhas = ranking.linhas(&musica, Dificuldade::Dificil, Instrumento::Baixo, 10, None).await.unwrap();
    let partida = ranking.partida(linhas[0].partida_id).await.unwrap().unwrap();

    assert_eq!(
        (
            partida.musica_id.as_str(),
            partida.dificuldade,
            partida.instrumento,
            partida.pontos,
            partida.maior_sequencia
        ),
        (musica.as_str(), Dificuldade::Dificil, Instrumento::Baixo, 500, Some(6))
    );
    assert!(ranking.partida(Uuid::new_v4()).await.unwrap().is_none());
}

#[tokio::test]
async fn so_o_recorde_guarda_o_replay() {
    let Some(banco) = banco().await else { return };
    let ranking = RankingPostgres(banco.0.clone());
    let musica = format!("teste:{}", Uuid::new_v4());
    let jogador = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let agora = Utc::now();
    let partida = |pontos, replay: u8, segundos| PartidaRegistrada {
        id: Uuid::new_v4(),
        conta_id: jogador.id,
        musica_id: musica.clone(),
        instrumento: Instrumento::Guitarra,
        pontos,
        resumo: ResumoDaPartida {
            dificuldade: Dificuldade::Facil,
            acertos: 1,
            total: 1,
            derrota: false,
            fantasma: false,
            maior_sequencia: None,
        },
        xp_ganho: 0,
        jogada_em: agora + Duration::seconds(segundos),
        replay: Some(vec![1, replay]),
    };
    banco.registrar_partida(&partida(500, 5, 0)).await.unwrap();
    banco.registrar_partida(&partida(900, 9, 1)).await.unwrap();
    banco.registrar_partida(&partida(700, 7, 2)).await.unwrap();

    let linhas = ranking.linhas(&musica, Dificuldade::Facil, Instrumento::Guitarra, 10, None).await.unwrap();
    let recorde = linhas[0].partida_id;
    assert_eq!(ranking.replay(recorde).await.unwrap(), Some(vec![1, 9]));
    assert!(ranking.partida(recorde).await.unwrap().unwrap().tem_replay);
    let com_replay: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM partidas WHERE musica_id = $1 AND replay IS NOT NULL")
        .bind(&musica)
        .fetch_one(&banco.0)
        .await
        .unwrap();
    assert_eq!(com_replay, 1);
}

#[tokio::test]
async fn catalogo_guarda_atualiza_e_busca_varias_musicas() {
    let Some(banco) = banco().await else { return };
    let catalogo = CatalogoPostgres(banco.0.clone());
    let id = format!("encore:{}", Uuid::new_v4().simple());
    let outro = format!("encore:{}", Uuid::new_v4().simple());
    catalogo.guardar(&id, &DadosDaMusica::default()).await.unwrap();
    let achada = DadosDaMusica {
        titulo: Some("Tom Sawyer".into()),
        artista: Some("Rush".into()),
        capa: Some("https://files.enchor.us/capa.jpg".into()),
    };
    catalogo.guardar(&id, &achada).await.unwrap();

    let guardadas = catalogo.buscar(&[id.clone(), outro.clone()]).await.unwrap();

    assert_eq!(guardadas.get(&id), Some(&achada));
    assert!(!guardadas.contains_key(&outro));
}

#[tokio::test]
async fn moderacao_guarda_moderadores_banidos_e_denuncias_e_limpa_com_a_conta() {
    let Some(banco) = banco().await else { return };
    let moderacao = ModeracaoPostgres(banco.0.clone());
    let admin = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let autor = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let quem_denuncia = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    sqlx::query("INSERT INTO equipe_moderacao (conta_id) VALUES ($1)")
        .bind(admin.id)
        .execute(&banco.0)
        .await
        .unwrap();
    assert_eq!(moderacao.situacao(admin.id).await.unwrap(), Situacao { admin: true, banido: false });

    // Banir conta que não existe não grava; banir de novo continua dando certo.
    assert!(!moderacao.banir(Uuid::new_v4(), admin.id).await.unwrap());
    assert!(moderacao.banir(autor.id, admin.id).await.unwrap());
    assert!(moderacao.banir(autor.id, admin.id).await.unwrap());
    assert!(moderacao.situacao(autor.id).await.unwrap().banido);
    assert!(moderacao.banidos().await.unwrap().iter().any(|b| b.conta_id == autor.id));
    moderacao.desbanir(autor.id).await.unwrap();
    assert!(!moderacao.situacao(autor.id).await.unwrap().banido);

    // Número alto e único: o banco é dividido com os outros testes.
    let n = i64::from(rand_n());
    let denuncia = Denuncia {
        mensagem_n: n,
        autor_id: autor.id,
        autor_nome: "Lucas".into(),
        texto: "spam".into(),
        mensagem_em: Utc::now(),
        denunciante_id: quem_denuncia.id,
    };
    moderacao.registrar_denuncia(&denuncia).await.unwrap();
    moderacao.registrar_denuncia(&denuncia).await.unwrap();
    let da_mensagem = |lista: Vec<riffrush_api::modules::moderacao::DenunciaRecebida>| lista.into_iter().filter(|d| d.denuncia.mensagem_n == n).count();
    assert_eq!(da_mensagem(moderacao.denuncias(200).await.unwrap()), 1);
    moderacao.resolver(n).await.unwrap();
    assert_eq!(da_mensagem(moderacao.denuncias(200).await.unwrap()), 0);

    // Excluir a conta leva junto o banimento e as denúncias dela.
    moderacao.registrar_denuncia(&denuncia).await.unwrap();
    moderacao.banir(autor.id, admin.id).await.unwrap();
    banco.excluir(autor.id).await.unwrap();
    assert_eq!(da_mensagem(moderacao.denuncias(200).await.unwrap()), 0);
    assert!(!moderacao.banidos().await.unwrap().iter().any(|b| b.conta_id == autor.id));
}

fn rand_n() -> u32 {
    (Uuid::new_v4().as_u128() % 1_000_000_000) as u32 + 1_000_000
}

#[tokio::test]
async fn recordes_pegam_a_melhor_partida_terminada_de_cada_musica() {
    let Some(banco) = banco().await else { return };
    let repositorio = PerfilPostgres(banco.0.clone());
    let conta = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    let jogar = |instrumento: Instrumento, pontos: u64, derrota: bool, fantasma: bool| PartidaRegistrada {
        id: Uuid::new_v4(),
        conta_id: conta.id,
        musica_id: "a".into(),
        instrumento,
        pontos,
        resumo: ResumoDaPartida {
            dificuldade: Dificuldade::Expert,
            acertos: 10,
            total: 10,
            derrota,
            fantasma,
            maior_sequencia: None,
        },
        xp_ganho: 0,
        jogada_em: Utc::now(),
        replay: None,
    };
    for partida in [
        jogar(Instrumento::Guitarra, 500, false, false),
        jogar(Instrumento::Guitarra, 900, false, false),
        // Vaiada e fantasma não viram recorde.
        jogar(Instrumento::Guitarra, 5000, true, false),
        jogar(Instrumento::Guitarra, 6000, false, true),
        jogar(Instrumento::Baixo, 300, false, false),
    ] {
        banco.registrar_partida(&partida).await.unwrap();
    }

    let mut recordes: Vec<_> = repositorio
        .recordes(conta.id)
        .await
        .unwrap()
        .into_iter()
        .map(|r| (r.instrumento, r.pontos, r.acertos, r.total))
        .collect();
    recordes.sort_by_key(|r| r.1);

    assert_eq!(recordes, [(Instrumento::Baixo, 300, 10, 10), (Instrumento::Guitarra, 900, 10, 10)]);
    assert!(repositorio.recordes(Uuid::new_v4()).await.unwrap().is_empty());
}

fn na_fila(conta_id: Uuid, md5: &str, enviada_em: chrono::DateTime<Utc>) -> PartidaNaFila {
    PartidaNaFila {
        id: Uuid::new_v4(),
        conta_id,
        md5: md5.into(),
        dificuldade: Dificuldade::Expert,
        instrumento: Instrumento::Baixo,
        replay: vec![2, 1, 2],
        enviada_em,
    }
}

#[tokio::test]
async fn a_fila_reserva_reagenda_desiste_e_conclui() {
    let Some(banco) = banco().await else { return };
    let fila = RejulgamentoPostgres(banco.0.clone());
    let conta = banco.entrar(&perfil(), Uuid::new_v4()).await.unwrap();
    // Um md5 por teste: a fila é a mesma para os testes que rodam juntos.
    let md5 = Uuid::new_v4().simple().to_string();
    let agora = Utc::now();
    let primeira = na_fila(conta.id, &md5, agora - Duration::seconds(2));
    let segunda = na_fila(conta.id, &md5, agora - Duration::seconds(1));
    let ids = (primeira.id, segunda.id);
    fila.enfileirar(primeira).await.unwrap();
    fila.enfileirar(segunda).await.unwrap();

    // A partida esperando na fila conta para o intervalo entre partidas.
    let ultima = banco.ultima_partida(conta.id).await.unwrap().unwrap();
    assert!((ultima - (agora - Duration::seconds(1))).num_milliseconds().abs() < 1);

    let minhas = |lote: Vec<riffrush_api::modules::rejulgamento::PartidaPendente>| lote.into_iter().filter(|p| p.md5 == md5).collect::<Vec<_>>();
    let pegas = minhas(fila.pegar(1000, agora).await.unwrap());
    assert_eq!(pegas.iter().map(|p| p.id).collect::<Vec<_>>(), [ids.0, ids.1]);
    assert_eq!(
        (pegas[0].tentativas, pegas[0].instrumento, pegas[0].replay.as_slice()),
        (1, Instrumento::Baixo, [2, 1, 2].as_slice())
    );
    // Reservadas, não saem de novo.
    assert!(minhas(fila.pegar(1000, agora).await.unwrap()).is_empty());

    fila.reagendar(ids.0, agora).await.unwrap();
    fila.desistir(ids.1, "o replay é de outro chart").await.unwrap();
    let de_novo = minhas(fila.pegar(1000, agora).await.unwrap());
    assert_eq!(de_novo.iter().map(|p| (p.id, p.tentativas)).collect::<Vec<_>>(), [(ids.0, 2)]);

    fila.concluir(ids.0).await.unwrap();
    fila.reagendar(ids.0, agora).await.unwrap();
    assert!(minhas(fila.pegar(1000, agora + Duration::hours(1)).await.unwrap()).is_empty());
}

#[tokio::test]
async fn o_cache_guarda_o_chart_uma_vez() {
    let Some(banco) = banco().await else { return };
    let cache = RejulgamentoPostgres(banco.0.clone());
    let md5 = Uuid::new_v4().simple().to_string();
    assert_eq!(cache.buscar(&md5).await.unwrap(), None);
    let chart = ChartGuardado {
        arquivo: b"[Song]".to_vec(),
        midi: false,
        atraso_ms: -12.5,
    };
    cache.guardar(&md5, &chart).await.unwrap();
    cache.guardar(&md5, &ChartGuardado { midi: true, ..chart.clone() }).await.unwrap();
    assert_eq!(cache.buscar(&md5).await.unwrap(), Some(chart));
}
