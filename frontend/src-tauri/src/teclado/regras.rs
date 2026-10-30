//! Quais teclas o jogo segura durante a partida, para o Windows não roubar o foco.

const TAB: u32 = 0x09;
const ALT: u32 = 0x12;
const ESC: u32 = 0x1B;
const WIN_ESQUERDA: u32 = 0x5B;
const WIN_DIREITA: u32 = 0x5C;
const F10: u32 = 0x79;
const ALT_ESQUERDO: u32 = 0xA4;
const ALT_DIREITO: u32 = 0xA5;

pub fn eh_alt(tecla: u32) -> bool {
    matches!(tecla, ALT | ALT_ESQUERDO | ALT_DIREITO)
}

/// `alt_preso` vem do próprio hook: o Alt é descartado, então o Windows não sabe que ele está preso.
/// Ctrl+Alt+Del nunca passa pelo hook, o Windows o trata antes.
pub fn deve_bloquear(tecla: u32, alt_preso: bool) -> bool {
    match tecla {
        WIN_ESQUERDA | WIN_DIREITA | F10 => true,
        t if eh_alt(t) => true,
        TAB | ESC => alt_preso,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bloqueia_a_tecla_windows_dos_dois_lados() {
        assert!(deve_bloquear(WIN_ESQUERDA, false));
        assert!(deve_bloquear(WIN_DIREITA, false));
    }

    #[test]
    fn bloqueia_alt_sozinho_e_f10_que_abrem_o_menu_da_janela() {
        for alt in [ALT, ALT_ESQUERDO, ALT_DIREITO] {
            assert!(deve_bloquear(alt, false));
        }
        assert!(deve_bloquear(F10, false));
    }

    #[test]
    fn bloqueia_alt_tab_e_alt_esc() {
        assert!(deve_bloquear(TAB, true));
        assert!(deve_bloquear(ESC, true));
    }

    #[test]
    fn tab_e_esc_sem_alt_passam_para_pausar_e_trocar_o_modo() {
        assert!(!deve_bloquear(TAB, false));
        assert!(!deve_bloquear(ESC, false));
    }

    #[test]
    fn as_teclas_do_jogo_passam() {
        // A, S, J, K, L, D, espaço, Enter, F11 e as setas.
        for tecla in [
            0x41, 0x53, 0x4A, 0x4B, 0x4C, 0x44, 0x20, 0x0D, 0x7A, 0x25, 0x26, 0x27, 0x28,
        ] {
            assert!(!deve_bloquear(tecla, false), "{tecla:#x}");
            assert!(!deve_bloquear(tecla, true), "{tecla:#x}");
        }
    }
}
