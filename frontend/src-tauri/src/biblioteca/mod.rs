//! Comandos da biblioteca do PC. Os arquivos vão no corpo bruto do invoke e os textos nos cabeçalhos.

mod armazem;

use armazem::{Armazem, Novo, Registro};
use std::sync::Mutex;
use tauri::Manager;

/// Abre na primeira chamada: a pasta do app só é conhecida com o app rodando.
#[derive(Default)]
pub struct EstadoDaBiblioteca(Mutex<Option<Armazem>>);

fn com_armazem<T>(app: &tauri::AppHandle, estado: &EstadoDaBiblioteca, f: impl FnOnce(&Armazem) -> Result<T, String>) -> Result<T, String> {
    let mut aberto = estado.0.lock().unwrap();
    if aberto.is_none() {
        let pasta = app.path().app_data_dir().map_err(|e| e.to_string())?;
        *aberto = Some(Armazem::abrir(&pasta)?);
    }
    f(aberto.as_ref().unwrap())
}

fn agora() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// Os cabeçalhos só aceitam ASCII: o front manda os textos com encodeURIComponent.
fn decodificar(texto: &str) -> String {
    let bytes = texto.as_bytes();
    let mut saida = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = if bytes[i] == b'%' { texto.get(i + 1..i + 3).and_then(|h| u8::from_str_radix(h, 16).ok()) } else { None };
        match hex {
            Some(byte) => {
                saida.push(byte);
                i += 3;
            }
            None => {
                saida.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&saida).into_owned()
}

fn cabecalho(request: &tauri::ipc::Request<'_>, nome: &str) -> Result<String, String> {
    request
        .headers()
        .get(nome)
        .and_then(|v| v.to_str().ok())
        .map(decodificar)
        .ok_or_else(|| format!("Faltou o cabeçalho {nome}"))
}

fn corpo<'a>(request: &'a tauri::ipc::Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => Ok(bytes),
        _ => Err("Esperava os bytes do arquivo".into()),
    }
}

#[tauri::command]
pub fn biblioteca_listar(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>) -> Result<Vec<Registro>, String> {
    com_armazem(&app, &estado, |a| a.listar())
}

/// Corpo: o arquivo da música. Cabeçalhos: `x-id`, `x-dados` (JSON), `x-nome` e `x-tipo`.
#[tauri::command]
pub fn biblioteca_guardar(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let (id, dados) = (cabecalho(&request, "x-id")?, cabecalho(&request, "x-dados")?);
    let (nome, tipo) = (cabecalho(&request, "x-nome")?, cabecalho(&request, "x-tipo")?);
    let arquivo = corpo(&request)?;
    com_armazem(&app, &estado, |a| a.guardar(Novo { id: &id, dados: &dados, nome_do_arquivo: &nome, tipo_do_arquivo: &tipo, arquivo }, agora()))
}

/// Corpo: a imagem da capa. Cabeçalho: `x-id`.
#[tauri::command]
pub fn biblioteca_guardar_capa(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let id = cabecalho(&request, "x-id")?;
    let capa = corpo(&request)?;
    com_armazem(&app, &estado, |a| a.guardar_capa(&id, capa))
}

#[tauri::command]
pub fn biblioteca_usar(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>, id: String) -> Result<(), String> {
    com_armazem(&app, &estado, |a| a.usar(&id, agora()))
}

#[tauri::command]
pub fn biblioteca_remover(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>, id: String) -> Result<(), String> {
    com_armazem(&app, &estado, |a| a.remover(&id))
}

#[tauri::command]
pub fn biblioteca_ler_arquivo(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>, id: String) -> Result<tauri::ipc::Response, String> {
    com_armazem(&app, &estado, |a| a.ler_arquivo(&id).map(tauri::ipc::Response::new).ok_or_else(|| "O arquivo da música sumiu".into()))
}

#[tauri::command]
pub fn biblioteca_ler_capa(app: tauri::AppHandle, estado: tauri::State<'_, EstadoDaBiblioteca>, id: String) -> Result<tauri::ipc::Response, String> {
    com_armazem(&app, &estado, |a| a.ler_capa(&id).map(tauri::ipc::Response::new).ok_or_else(|| "A música não tem capa".into()))
}

#[cfg(test)]
mod testes {
    use super::decodificar;

    #[test]
    fn decodifica_o_texto_do_encode_uri_component() {
        assert_eq!(decodificar("Banda%20X%20-%20Hit%20%C3%A0s%20vezes"), "Banda X - Hit às vezes");
        assert_eq!(decodificar("%7B%22titulo%22%3A%22Riff%22%7D"), r#"{"titulo":"Riff"}"#);
    }

    #[test]
    fn deixa_como_esta_o_que_nao_e_codigo() {
        assert_eq!(decodificar("100%"), "100%");
        assert_eq!(decodificar("%zz"), "%zz");
    }
}
