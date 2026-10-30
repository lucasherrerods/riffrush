//! Amigos: o código de amigo, pedidos com aceite, bloqueios e sugestões.
//! Quem está online e o convite para a sala ficam no relay; aqui fica o que precisa durar.

mod casos_de_uso;
mod dominio;
mod http;
mod portas;
mod postgres;

#[cfg(any(test, feature = "testes"))]
pub use casos_de_uso::fakes;
pub use casos_de_uso::{Alvo, ErroDaAmizade, Listas, Pedido, ServicosDeAmizade};
pub use dominio::{
    decidir_pedido, gerar_codigo, normalizar_codigo, Contagens, Decisao, PedidoRecusado, Pessoa, Relacao, Sugestao, Vinculo, MAXIMO_DE_AMIGOS,
    MAXIMO_DE_PEDIDOS_ENVIADOS, PEDIDOS_POR_HORA, SUGESTOES,
};
pub use http::{
    __path_aceitar, __path_amigos, __path_bloquear, __path_desbloquear, __path_desfazer, __path_pedir, __path_sugestoes, aceitar, amigos, bloquear,
    desbloquear, desfazer, pedir, rotas, sugestoes, CorpoDoPedido, PessoaDaAmizade, RespostaDoPedido, RespostaDosAmigos, SugestaoDeAmizade,
};
pub use portas::RepositorioDeAmizades;
pub use postgres::AmizadesPostgres;
