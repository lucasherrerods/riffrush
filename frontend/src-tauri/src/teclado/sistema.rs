//! O hook de teclado de baixo nível do Windows, numa thread só dele com o próprio laço de mensagens.

use super::regras::{deve_bloquear, eh_alt};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::thread::JoinHandle;
use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, KBDLLHOOKSTRUCT, MSG, PM_NOREMOVE, PeekMessageW,
    PostThreadMessageW, SetWindowsHookExW, UnhookWindowsHookEx, WH_KEYBOARD_LL, WM_KEYDOWN,
    WM_QUIT, WM_SYSKEYDOWN,
};
use windows::core::Interface;

static ALT_PRESO: AtomicBool = AtomicBool::new(false);

/// O Windows desliga o hook que demora a responder: aqui só se consulta a regra e se devolve.
unsafe extern "system" fn ao_teclar(codigo: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if codigo >= 0 {
        let evento = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let mensagem = wparam.0 as u32;
        if eh_alt(evento.vkCode) {
            ALT_PRESO.store(
                mensagem == WM_KEYDOWN || mensagem == WM_SYSKEYDOWN,
                Ordering::Relaxed,
            );
        }
        if deve_bloquear(evento.vkCode, ALT_PRESO.load(Ordering::Relaxed)) {
            return LRESULT(1);
        }
    }
    unsafe { CallNextHookEx(None, codigo, wparam, lparam) }
}

pub struct Hook {
    id_da_thread: u32,
    thread: Option<JoinHandle<()>>,
}

impl Hook {
    /// `None` se o Windows recusar o hook: o jogo segue sem o bloqueio.
    pub fn instalar() -> Option<Self> {
        ALT_PRESO.store(false, Ordering::Relaxed);
        let (avisar, aviso) = mpsc::channel();
        let thread = std::thread::spawn(move || unsafe {
            let modulo = GetModuleHandleW(None).ok().map(HINSTANCE::from);
            let Ok(hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(ao_teclar), modulo, 0) else {
                let _ = avisar.send(None);
                return;
            };
            let mut mensagem = MSG::default();
            // Cria a fila de mensagens antes de avisar, para o WM_QUIT do Drop não se perder.
            let _ = PeekMessageW(&mut mensagem, None, 0, 0, PM_NOREMOVE);
            let _ = avisar.send(Some(GetCurrentThreadId()));
            while GetMessageW(&mut mensagem, None, 0, 0).0 > 0 {}
            let _ = UnhookWindowsHookEx(hook);
        });
        match aviso.recv().ok().flatten() {
            Some(id_da_thread) => Some(Hook {
                id_da_thread,
                thread: Some(thread),
            }),
            None => {
                let _ = thread.join();
                None
            }
        }
    }
}

impl Drop for Hook {
    fn drop(&mut self) {
        unsafe {
            let _ = PostThreadMessageW(self.id_da_thread, WM_QUIT, WPARAM(0), LPARAM(0));
        }
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        ALT_PRESO.store(false, Ordering::Relaxed);
    }
}

/// F5, Ctrl+R, Ctrl+P, F12, zoom etc. do WebView2. O `preventDefault` da partida cobre o que escapar.
pub fn atalhos_do_navegador(janela: &WebviewWindow, ligados: bool) {
    let _ = janela.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };
        let Ok(ajustes) = core
            .Settings()
            .and_then(|a| a.cast::<ICoreWebView2Settings3>())
        else {
            return;
        };
        let _ = ajustes.SetAreBrowserAcceleratorKeysEnabled(ligados);
    });
}
