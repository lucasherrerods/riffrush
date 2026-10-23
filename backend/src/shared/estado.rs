use std::sync::Arc;

use crate::modules::saude::VerificadorDoBanco;

/// Os adaptadores de saída que as rotas usam. O main monta com os de verdade; os testes, com fakes.
#[derive(Clone)]
pub struct EstadoDoApp {
    pub banco: Arc<dyn VerificadorDoBanco>,
}
