use tauri::Manager;

mod biblioteca;
mod lan;
mod login;
mod teclado;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(lan::EstadoDaSala::default())
        .manage(biblioteca::EstadoDaBiblioteca::default())
        .manage(teclado::EstadoDoTeclado::default())
        .on_window_event(|janela, evento| {
            if let tauri::WindowEvent::Focused(em_foco) = evento {
                teclado::foco_mudou(janela.app_handle(), *em_foco);
            }
        })
        .invoke_handler(tauri::generate_handler![
            lan::lan_criar_sala,
            lan::lan_fechar_sala,
            lan::lan_compartilhar_musica,
            lan::lan_procurar_salas,
            login::login_pelo_navegador,
            biblioteca::biblioteca_listar,
            biblioteca::biblioteca_guardar,
            biblioteca::biblioteca_guardar_capa,
            biblioteca::biblioteca_usar,
            biblioteca::biblioteca_remover,
            biblioteca::biblioteca_ler_arquivo,
            biblioteca::biblioteca_ler_capa,
            teclado::teclado_bloquear
        ])
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o Riff Rush")
        .run(|app, evento| {
            if let tauri::RunEvent::Exit = evento {
                teclado::desligar(app);
            }
        });
}
