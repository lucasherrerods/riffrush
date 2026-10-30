//! Durante a partida, segura as teclas do sistema (Windows, Alt, F10, Alt+Tab) e os atalhos do WebView2,
//! para um esbarrão não tirar o jogo da tela. Só vale com a janela em foco: no blur o hook sai.

mod regras;
#[cfg(windows)]
mod sistema;

use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WebviewWindow};

#[derive(Default)]
pub struct EstadoDoTeclado {
    /// A partida pediu o bloqueio. O hook só fica instalado enquanto a janela também está em foco.
    pedido: Mutex<bool>,
    #[cfg(windows)]
    hook: Mutex<Option<sistema::Hook>>,
}

impl EstadoDoTeclado {
    fn aplicar(&self, ligar: bool) {
        #[cfg(windows)]
        if let Ok(mut hook) = self.hook.lock() {
            match (ligar, hook.is_some()) {
                (true, false) => *hook = sistema::Hook::instalar(),
                // O Drop do Hook o remove.
                (false, true) => *hook = None,
                _ => {}
            }
        }
        #[cfg(not(windows))]
        let _ = ligar;
    }
}

#[tauri::command]
pub fn teclado_bloquear(ligar: bool, janela: WebviewWindow, estado: State<'_, EstadoDoTeclado>) {
    if let Ok(mut pedido) = estado.pedido.lock() {
        *pedido = ligar;
    }
    let em_foco = janela.is_focused().unwrap_or(false);
    estado.aplicar(ligar && em_foco);
    atalhos_do_navegador(&janela, !ligar);
}

/// Chamado nos eventos da janela: o hook sai no blur e volta no foco, se a partida ainda pedir.
pub fn foco_mudou(app: &AppHandle, em_foco: bool) {
    let estado = app.state::<EstadoDoTeclado>();
    let pedido = estado.pedido.lock().map(|p| *p).unwrap_or(false);
    estado.aplicar(pedido && em_foco);
}

/// Ao fechar o app, o hook sai antes do processo morrer.
pub fn desligar(app: &AppHandle) {
    app.state::<EstadoDoTeclado>().aplicar(false);
}

fn atalhos_do_navegador(webview: &WebviewWindow, ligados: bool) {
    #[cfg(windows)]
    sistema::atalhos_do_navegador(webview, ligados);
    #[cfg(not(windows))]
    let _ = (webview, ligados);
}
