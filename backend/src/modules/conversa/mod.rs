//! Conversas privadas entre amigos: a API guarda as mensagens e confere a amizade,
//! e o relay só entrega na hora para quem está conectado.

mod casos_de_uso;
mod cifra;
mod dominio;
mod formato;
mod http;
mod portas;
mod postgres;
mod relay;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{ErroDaConversa, ServicosDeConversa};
pub use cifra::{CifraDasMensagens, ErroDaCifra};
pub use dominio::{
    limpar_sugestao, limpar_texto, MensagemPrivada, ModoDaSugestao, NaoLidas, NovaMensagem, Remetente, SugestaoDeMusica, MENSAGENS_POR_MINUTO,
    MENSAGENS_POR_PAGINA, TAMANHO_MAXIMO_DO_TEXTO,
};
pub use http::{
    __path_enviar, __path_historico, __path_marcar_lidas, __path_nao_lidas, enviar, historico, marcar_lidas, nao_lidas, rotas, CorpoDaMensagem,
    MensagemDaConversa, NaoLidasDoAmigo, SugestaoDaMensagem,
};
pub use portas::{EntregaNaHora, RepositorioDeConversas};
pub use postgres::ConversasPostgres;
pub use relay::EntregaPeloRelay;
