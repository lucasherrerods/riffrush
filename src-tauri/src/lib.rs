mod lan;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(lan::EstadoDaSala::default())
        .invoke_handler(tauri::generate_handler![
            lan::lan_criar_sala,
            lan::lan_fechar_sala,
            lan::lan_compartilhar_musica,
            lan::lan_procurar_salas
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Riff Rush");
}
