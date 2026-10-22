//! Servidor da sala em LAN.
//!
//! Quem cria a sala sobe um servidor HTTP que:
//! - serve o próprio jogo (pasta `dist`), para celulares jogarem pelo navegador;
//! - repassa as mensagens da partida por WebSocket (`/ws`), até 4 jogadores;
//! - entrega a música importada pelo host (`/musica`), para todos tocarem a mesma.
//!
//! Enquanto a sala está aberta, um anúncio UDP avisa a rede para outros apps acharem a sala.
//! Quem manda na sala é o cliente do host, no TypeScript; aqui só se repassa.

pub mod protocolo;

use std::{
    net::{SocketAddr, UdpSocket},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use rust_embed::RustEmbed;
use serde::Serialize;
use tokio::sync::{broadcast, oneshot, RwLock};

use protocolo::{caminho_do_arquivo, embrulhar, ler_anuncio, Anuncio, MAXIMO_DE_JOGADORES, PORTA_DA_SALA, PORTA_DO_ANUNCIO};

#[derive(RustEmbed)]
#[folder = "../dist"]
#[allow_missing = true]
struct ArquivosDoJogo;

#[derive(Clone)]
struct Compartilhado {
    canal: broadcast::Sender<String>,
    jogadores: Arc<AtomicUsize>,
    proximo_id: Arc<AtomicUsize>,
    /// (tipo, bytes) da música importada que o host compartilhou.
    musica: Arc<RwLock<Option<(String, Vec<u8>)>>>,
}

struct SalaAberta {
    desligar: oneshot::Sender<()>,
    parar_anuncio: Arc<AtomicBool>,
    compartilhado: Compartilhado,
    info: InfoDaSala,
}

#[derive(Default)]
pub struct EstadoDaSala {
    sala: Mutex<Option<SalaAberta>>,
}

#[derive(Serialize, Clone)]
pub struct InfoDaSala {
    ip: String,
    porta: u16,
    endereco: String,
}

#[derive(Serialize)]
pub struct SalaEncontrada {
    nome: String,
    ip: String,
    porta: u16,
    jogadores: usize,
}

#[tauri::command]
pub async fn lan_criar_sala(estado: tauri::State<'_, EstadoDaSala>, nome: String) -> Result<InfoDaSala, String> {
    if let Some(sala) = estado.sala.lock().unwrap().as_ref() {
        return Ok(sala.info.clone());
    }

    let ouvinte = tokio::net::TcpListener::bind(("0.0.0.0", PORTA_DA_SALA))
        .await
        .map_err(|e| format!("Não consegui abrir a porta {PORTA_DA_SALA}: {e}"))?;

    let (canal, _) = broadcast::channel(512);
    let compartilhado = Compartilhado {
        canal,
        jogadores: Arc::new(AtomicUsize::new(0)),
        proximo_id: Arc::new(AtomicUsize::new(0)),
        musica: Arc::new(RwLock::new(None)),
    };
    let rotas = Router::new()
        .route("/ws", get(abrir_websocket))
        .route("/musica", get(entregar_musica))
        .fallback(entregar_arquivo)
        .with_state(compartilhado.clone());

    let (desligar, desligado) = oneshot::channel::<()>();
    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(ouvinte, rotas)
            .with_graceful_shutdown(async {
                let _ = desligado.await;
            })
            .await;
    });

    let parar_anuncio = Arc::new(AtomicBool::new(false));
    anunciar(nome, compartilhado.jogadores.clone(), parar_anuncio.clone());

    let ip = local_ip_address::local_ip().map(|ip| ip.to_string()).unwrap_or_else(|_| "127.0.0.1".into());
    let info = InfoDaSala { endereco: format!("http://{ip}:{PORTA_DA_SALA}"), ip, porta: PORTA_DA_SALA };
    *estado.sala.lock().unwrap() = Some(SalaAberta { desligar, parar_anuncio, compartilhado, info: info.clone() });
    Ok(info)
}

#[tauri::command]
pub fn lan_fechar_sala(estado: tauri::State<'_, EstadoDaSala>) {
    if let Some(sala) = estado.sala.lock().unwrap().take() {
        sala.parar_anuncio.store(true, Ordering::Relaxed);
        let _ = sala.desligar.send(());
    }
}

/// Recebe os bytes da música importada (corpo bruto do invoke) e o tipo no cabeçalho `x-tipo`.
#[tauri::command]
pub async fn lan_compartilhar_musica(estado: tauri::State<'_, EstadoDaSala>, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("Esperava os bytes da música".into());
    };
    let tipo = request
        .headers()
        .get("x-tipo")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let musica = estado
        .sala
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.compartilhado.musica.clone())
        .ok_or("A sala não está aberta")?;
    *musica.write().await = Some((tipo, bytes.clone()));
    Ok(())
}

/// Escuta os anúncios por 1,5 s e devolve as salas encontradas na rede.
#[tauri::command]
pub async fn lan_procurar_salas() -> Result<Vec<SalaEncontrada>, String> {
    tauri::async_runtime::spawn_blocking(|| -> Result<Vec<SalaEncontrada>, String> {
        use socket2::{Domain, Protocol, Socket, Type};
        let socket = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP)).map_err(|e| e.to_string())?;
        // Permite dois apps na mesma máquina escutarem a mesma porta.
        socket.set_reuse_address(true).map_err(|e| e.to_string())?;
        socket
            .bind(&SocketAddr::from(([0, 0, 0, 0], PORTA_DO_ANUNCIO)).into())
            .map_err(|e| format!("Não consegui escutar a rede: {e}"))?;
        let socket: UdpSocket = socket.into();
        socket.set_read_timeout(Some(Duration::from_millis(200))).map_err(|e| e.to_string())?;

        let mut salas: Vec<SalaEncontrada> = Vec::new();
        let mut buffer = [0u8; 1024];
        let fim = Instant::now() + Duration::from_millis(1500);
        while Instant::now() < fim {
            let Ok((tamanho, origem)) = socket.recv_from(&mut buffer) else { continue };
            let Some(anuncio) = ler_anuncio(&buffer[..tamanho]) else { continue };
            let mut ip = origem.ip().to_string();
            if ip == "127.0.0.1" {
                ip = local_ip_address::local_ip().map(|i| i.to_string()).unwrap_or(ip);
            }
            if !salas.iter().any(|s| s.ip == ip && s.porta == anuncio.porta) {
                salas.push(SalaEncontrada { nome: anuncio.nome, ip, porta: anuncio.porta, jogadores: anuncio.jogadores });
            }
        }
        Ok(salas)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn anunciar(nome: String, jogadores: Arc<AtomicUsize>, parar: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let Ok(socket) = UdpSocket::bind("0.0.0.0:0") else { return };
        let _ = socket.set_broadcast(true);
        while !parar.load(Ordering::Relaxed) {
            if let Ok(bytes) = serde_json::to_vec(&Anuncio::novo(&nome, jogadores.load(Ordering::Relaxed))) {
                let _ = socket.send_to(&bytes, ("255.255.255.255", PORTA_DO_ANUNCIO));
                // Também no loopback, para dois apps na mesma máquina se acharem.
                let _ = socket.send_to(&bytes, ("127.0.0.1", PORTA_DO_ANUNCIO));
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}

async fn abrir_websocket(ws: WebSocketUpgrade, State(c): State<Compartilhado>) -> Response {
    ws.on_upgrade(move |socket| atender_jogador(socket, c))
}

async fn atender_jogador(socket: WebSocket, c: Compartilhado) {
    let (mut saida, mut entrada) = socket.split();
    if c.jogadores.load(Ordering::SeqCst) >= MAXIMO_DE_JOGADORES {
        let _ = saida.send(Message::Text(r#"{"de":0,"msg":{"tipo":"cheia"}}"#.into())).await;
        return;
    }
    c.jogadores.fetch_add(1, Ordering::SeqCst);
    let id = c.proximo_id.fetch_add(1, Ordering::SeqCst) + 1;
    let _ = saida
        .send(Message::Text(format!(r#"{{"de":0,"msg":{{"tipo":"bemVindo","id":{id}}}}}"#).into()))
        .await;

    let mut recebidas = c.canal.subscribe();
    let mut enviar = tokio::spawn(async move {
        loop {
            match recebidas.recv().await {
                Ok(texto) => {
                    if saida.send(Message::Text(texto.into())).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let canal = c.canal.clone();
    let mut receber = tokio::spawn(async move {
        while let Some(Ok(mensagem)) = entrada.next().await {
            match mensagem {
                Message::Text(texto) => {
                    if let Some(embrulhada) = embrulhar(id, texto.as_str()) {
                        let _ = canal.send(embrulhada);
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut enviar => receber.abort(),
        _ = &mut receber => enviar.abort(),
    }
    c.jogadores.fetch_sub(1, Ordering::SeqCst);
    let _ = c.canal.send(format!(r#"{{"de":{id},"msg":{{"tipo":"saiu"}}}}"#));
}

async fn entregar_musica(State(c): State<Compartilhado>) -> Response {
    match c.musica.read().await.as_ref() {
        Some((tipo, bytes)) => Response::builder()
            .header(header::CONTENT_TYPE, tipo.as_str())
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(bytes.clone()))
            .unwrap(),
        None => (StatusCode::NOT_FOUND, "nenhuma música compartilhada").into_response(),
    }
}

async fn entregar_arquivo(uri: Uri) -> Response {
    let pedido = caminho_do_arquivo(uri.path());
    let (arquivo, caminho) = match ArquivosDoJogo::get(pedido) {
        Some(arquivo) => (arquivo, pedido),
        None => match ArquivosDoJogo::get("index.html") {
            Some(arquivo) => (arquivo, "index.html"),
            None => return (StatusCode::NOT_FOUND, "rode `npm run build` para gerar a versão web").into_response(),
        },
    };
    let tipo = mime_guess::from_path(caminho).first_or_octet_stream();
    Response::builder()
        .header(header::CONTENT_TYPE, tipo.as_ref())
        .body(Body::from(arquivo.data.into_owned()))
        .unwrap()
}
