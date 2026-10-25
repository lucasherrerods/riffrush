//! Moderação do chat global: quem é da equipe, quem está banido e as denúncias.
//! As mensagens ficam no relay (tempo real, 24 horas); o que precisa durar fica aqui.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;
mod relay;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{ErroDaModeracao, ServicosDeModeracao};
pub use dominio::{assinar_pedido, pedido_confere, Banido, Denuncia, DenunciaRecebida, Situacao, VALIDADE_DO_PEDIDO_EM_SEGUNDOS};
pub use http::{
    __path_banidos, __path_banir, __path_denunciar, __path_denuncias, __path_desbanir, __path_resolver, banidos, banir, denunciar, denuncias, desbanir,
    resolver, rotas, BanidoDaEquipe, CorpoDaDenuncia, DenunciaDaEquipe,
};
pub use portas::{AvisoAoRelay, AvisoDeModeracao, RepositorioDeModeracao};
pub use postgres::ModeracaoPostgres;
pub use relay::{endereco_http, RelayHttp, CABECALHO_DA_ASSINATURA, CABECALHO_DA_HORA};
