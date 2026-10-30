use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Quantos amigos uma conta pode ter.
pub const MAXIMO_DE_AMIGOS: u32 = 200;
/// Pedidos esperando resposta que uma conta pode ter enviado ao mesmo tempo.
pub const MAXIMO_DE_PEDIDOS_ENVIADOS: u32 = 50;
/// Pedidos por hora da mesma conta, para ninguém sair pedindo a todo mundo.
pub const PEDIDOS_POR_HORA: u32 = 20;
/// Sugestões mostradas de uma vez.
pub const SUGESTOES: u32 = 10;

/// Letras e números sem os que se confundem (0/O, 1/I/L).
const ALFABETO: &[u8] = b"23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PREFIXO: &str = "RIFF-";
const TAMANHO_DO_CODIGO: usize = 6;

/// O código de amigo sai dos bytes de um id aleatório: `RIFF-7K2Q9M`.
pub fn gerar_codigo(semente: Uuid) -> String {
    let mut numero = semente.as_u128();
    let mut codigo = String::from(PREFIXO);
    for _ in 0..TAMANHO_DO_CODIGO {
        codigo.push(ALFABETO[(numero % ALFABETO.len() as u128) as usize] as char);
        numero /= ALFABETO.len() as u128;
    }
    codigo
}

/// Aceita o código do jeito que a pessoa colar: minúsculo, com espaços ou sem o `RIFF-`.
pub fn normalizar_codigo(texto: &str) -> Option<String> {
    let limpo = texto.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_uppercase();
    let corpo = limpo.strip_prefix(PREFIXO).or_else(|| limpo.strip_prefix("RIFF")).unwrap_or(&limpo);
    let valido = corpo.len() == TAMANHO_DO_CODIGO && corpo.bytes().all(|b| ALFABETO.contains(&b));
    valido.then(|| format!("{PREFIXO}{corpo}"))
}

/// Como duas contas estão ligadas, olhando de quem pede.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Relacao {
    Nenhuma,
    Amigos,
    /// Quem pede já tinha pedido antes.
    PedidoEnviado,
    /// A outra pessoa já tinha pedido: o pedido novo vira aceite.
    PedidoRecebido,
    /// Quem pede bloqueou a outra pessoa.
    Bloqueou,
    /// A outra pessoa bloqueou quem pede.
    FoiBloqueado,
}

/// O que fazer com um pedido de amizade.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decisao {
    CriarPedido,
    Aceitar,
    /// Fingir que deu certo: quem foi bloqueado não fica sabendo.
    Ignorar,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum PedidoRecusado {
    #[error("não dá para pedir amizade a si mesmo")]
    SiMesmo,
    #[error("vocês já são amigos")]
    JaSaoAmigos,
    #[error("o pedido já foi enviado")]
    JaPediu,
    #[error("desbloqueie a pessoa antes de pedir amizade")]
    Bloqueada,
    #[error("a lista de amigos está cheia")]
    ListaCheia,
    #[error("pedidos demais esperando resposta")]
    PedidosDemais,
}

/// Quantos amigos e pedidos as duas contas já têm.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Contagens {
    pub amigos_de_quem_pede: u32,
    pub enviados_de_quem_pede: u32,
    pub amigos_do_outro: u32,
}

pub fn decidir_pedido(quem: Uuid, outro: Uuid, relacao: Relacao, contagens: Contagens) -> Result<Decisao, PedidoRecusado> {
    if quem == outro {
        return Err(PedidoRecusado::SiMesmo);
    }
    let cheia = contagens.amigos_de_quem_pede >= MAXIMO_DE_AMIGOS || contagens.amigos_do_outro >= MAXIMO_DE_AMIGOS;
    match relacao {
        Relacao::Amigos => Err(PedidoRecusado::JaSaoAmigos),
        Relacao::PedidoEnviado => Err(PedidoRecusado::JaPediu),
        Relacao::Bloqueou => Err(PedidoRecusado::Bloqueada),
        Relacao::FoiBloqueado => Ok(Decisao::Ignorar),
        _ if cheia => Err(PedidoRecusado::ListaCheia),
        Relacao::PedidoRecebido => Ok(Decisao::Aceitar),
        Relacao::Nenhuma if contagens.enviados_de_quem_pede >= MAXIMO_DE_PEDIDOS_ENVIADOS => Err(PedidoRecusado::PedidosDemais),
        Relacao::Nenhuma => Ok(Decisao::CriarPedido),
    }
}

/// Em que lista a outra pessoa aparece.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Vinculo {
    Amigo,
    Recebido,
    Enviado,
    Bloqueado,
}

/// Alguém nas listas de amizade de uma conta.
#[derive(Debug, Clone, PartialEq)]
pub struct Pessoa {
    pub conta_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub xp_total: u64,
    pub visto_em: Option<DateTime<Utc>>,
    /// Amizade aceita, pedido feito ou bloqueio.
    pub desde: DateTime<Utc>,
    pub vinculo: Vinculo,
}

/// Alguém que a conta talvez conheça: amigo de amigos.
#[derive(Debug, Clone, PartialEq)]
pub struct Sugestao {
    pub conta_id: Uuid,
    pub nome: String,
    pub avatar: Option<String>,
    pub xp_total: u64,
    pub amigos_em_comum: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn o_codigo_tem_o_prefixo_e_seis_letras_sem_as_confusas() {
        let codigo = gerar_codigo(Uuid::from_u128(123_456_789));
        assert!(codigo.starts_with("RIFF-"));
        assert_eq!(codigo.len(), 11);
        assert!(!codigo[5..].contains(['0', 'O', '1', 'I', 'L']));
        assert_ne!(gerar_codigo(Uuid::from_u128(1)), gerar_codigo(Uuid::from_u128(2)));
    }

    #[test]
    fn le_o_codigo_do_jeito_que_a_pessoa_colar() {
        let codigo = gerar_codigo(Uuid::from_u128(99));
        assert_eq!(normalizar_codigo(&codigo).as_deref(), Some(codigo.as_str()));
        assert_eq!(normalizar_codigo(&format!("  {}  ", codigo.to_lowercase())).as_deref(), Some(codigo.as_str()));
        assert_eq!(normalizar_codigo(&codigo[5..]).as_deref(), Some(codigo.as_str()));
        assert_eq!(normalizar_codigo("RIFF-ABC"), None);
        assert_eq!(normalizar_codigo("RIFF-ABCDE0"), None);
        assert_eq!(normalizar_codigo(""), None);
    }

    const A: Uuid = Uuid::from_u128(1);
    const B: Uuid = Uuid::from_u128(2);

    #[test]
    fn pedido_novo_cria_e_pedido_cruzado_aceita() {
        assert_eq!(decidir_pedido(A, B, Relacao::Nenhuma, Contagens::default()), Ok(Decisao::CriarPedido));
        assert_eq!(decidir_pedido(A, B, Relacao::PedidoRecebido, Contagens::default()), Ok(Decisao::Aceitar));
    }

    #[test]
    fn recusa_a_si_mesmo_repetido_e_quem_ja_e_amigo() {
        assert_eq!(decidir_pedido(A, A, Relacao::Nenhuma, Contagens::default()), Err(PedidoRecusado::SiMesmo));
        assert_eq!(decidir_pedido(A, B, Relacao::PedidoEnviado, Contagens::default()), Err(PedidoRecusado::JaPediu));
        assert_eq!(decidir_pedido(A, B, Relacao::Amigos, Contagens::default()), Err(PedidoRecusado::JaSaoAmigos));
    }

    #[test]
    fn quem_foi_bloqueado_nao_fica_sabendo_e_quem_bloqueou_precisa_desbloquear() {
        assert_eq!(decidir_pedido(A, B, Relacao::FoiBloqueado, Contagens::default()), Ok(Decisao::Ignorar));
        assert_eq!(decidir_pedido(A, B, Relacao::Bloqueou, Contagens::default()), Err(PedidoRecusado::Bloqueada));
    }

    #[test]
    fn respeita_os_limites_de_amigos_e_de_pedidos() {
        let cheia = Contagens {
            amigos_do_outro: MAXIMO_DE_AMIGOS,
            ..Default::default()
        };
        assert_eq!(decidir_pedido(A, B, Relacao::Nenhuma, cheia), Err(PedidoRecusado::ListaCheia));
        assert_eq!(decidir_pedido(A, B, Relacao::PedidoRecebido, cheia), Err(PedidoRecusado::ListaCheia));
        let pedidos = Contagens {
            enviados_de_quem_pede: MAXIMO_DE_PEDIDOS_ENVIADOS,
            ..Default::default()
        };
        assert_eq!(decidir_pedido(A, B, Relacao::Nenhuma, pedidos), Err(PedidoRecusado::PedidosDemais));
        // Aceitar não cria pedido novo: o limite de enviados não conta.
        assert_eq!(decidir_pedido(A, B, Relacao::PedidoRecebido, pedidos), Ok(Decisao::Aceitar));
    }
}
