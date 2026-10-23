mod biblioteca;
mod lan;
mod login;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(lan::EstadoDaSala::default())
        .manage(biblioteca::EstadoDaBiblioteca::default())
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
            biblioteca::biblioteca_ler_capa
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Riff Rush");
}
