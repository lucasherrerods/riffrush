//! O motor do Mania para o app, em WASM: o mesmo código que a API usa para rejulgar os replays.
//! O app passa o texto do `.osu`, e o WASM lê o mapa com o mesmo parser da API, para os dois nunca divergirem.

use riffrush_motor_mania as motor;
use wasm_bindgen::prelude::*;

/// Os julgamentos viram números para atravessar para o JS: 0 = MAX … 5 = Miss.
fn codigo(julgamento: motor::Julgamento) -> i32 {
    match julgamento {
        motor::Julgamento::Max => 0,
        motor::Julgamento::J300 => 1,
        motor::Julgamento::J200 => 2,
        motor::Julgamento::J100 => 3,
        motor::Julgamento::J50 => 4,
        motor::Julgamento::Miss => 5,
    }
}

fn erro_do_beatmap(erro: motor::ErroDoBeatmap) -> JsError {
    JsError::new(&match erro {
        motor::ErroDoBeatmap::NaoEhOsu => "Não é um arquivo .osu.".to_string(),
        motor::ErroDoBeatmap::NaoEhMania(modo) => format!("O mapa é de outro modo do osu! ({modo})."),
        motor::ErroDoBeatmap::TeclasInvalidas(teclas) => format!("Número de teclas inválido: {teclas}."),
        motor::ErroDoBeatmap::SemNotas => "O mapa não tem notas.".to_string(),
        motor::ErroDoBeatmap::LinhaInvalida(linha) => format!("Linha {linha} do .osu não pôde ser lida."),
    })
}

/// O que a biblioteca e a seleção mostram de um `.osu`, sem montar a partida.
#[wasm_bindgen]
pub struct InfoDoBeatmap {
    beatmap: motor::Beatmap,
}

#[wasm_bindgen]
impl InfoDoBeatmap {
    #[wasm_bindgen(constructor)]
    pub fn new(texto: &str) -> Result<InfoDoBeatmap, JsError> {
        motor::ler_beatmap(texto).map(|beatmap| InfoDoBeatmap { beatmap }).map_err(erro_do_beatmap)
    }
    #[wasm_bindgen(getter)]
    pub fn titulo(&self) -> String {
        self.beatmap.metadados.titulo.clone()
    }
    #[wasm_bindgen(getter, js_name = tituloUnicode)]
    pub fn titulo_unicode(&self) -> String {
        self.beatmap.metadados.titulo_unicode.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn artista(&self) -> String {
        self.beatmap.metadados.artista.clone()
    }
    #[wasm_bindgen(getter, js_name = artistaUnicode)]
    pub fn artista_unicode(&self) -> String {
        self.beatmap.metadados.artista_unicode.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn mapper(&self) -> String {
        self.beatmap.metadados.mapper.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn dificuldade(&self) -> String {
        self.beatmap.metadados.dificuldade.clone()
    }
    #[wasm_bindgen(getter, js_name = beatmapId)]
    pub fn beatmap_id(&self) -> Option<f64> {
        self.beatmap.metadados.beatmap_id.map(|id| id as f64)
    }
    #[wasm_bindgen(getter, js_name = beatmapsetId)]
    pub fn beatmapset_id(&self) -> Option<f64> {
        self.beatmap.metadados.beatmapset_id.map(|id| id as f64)
    }
    #[wasm_bindgen(getter)]
    pub fn teclas(&self) -> u8 {
        self.beatmap.dificuldade.teclas
    }
    #[wasm_bindgen(getter)]
    pub fn od(&self) -> f64 {
        self.beatmap.dificuldade.od
    }
    #[wasm_bindgen(getter)]
    pub fn hp(&self) -> f64 {
        self.beatmap.dificuldade.hp
    }
    #[wasm_bindgen(getter, js_name = arquivoDeAudio)]
    pub fn arquivo_de_audio(&self) -> String {
        self.beatmap.geral.arquivo_de_audio.clone()
    }
    #[wasm_bindgen(getter, js_name = previaMs)]
    pub fn previa_ms(&self) -> i32 {
        self.beatmap.geral.previa_ms
    }
    #[wasm_bindgen(getter)]
    pub fn fundo(&self) -> Option<String> {
        self.beatmap.fundo.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn notas(&self) -> u32 {
        self.beatmap.notas.len() as u32
    }
    #[wasm_bindgen(getter, js_name = notasLongas)]
    pub fn notas_longas(&self) -> u32 {
        self.beatmap.notas.iter().filter(|n| n.fim_ms.is_some()).count() as u32
    }
    /// Duração do mapa em ms, do começo até o fim da última nota.
    #[wasm_bindgen(getter, js_name = duracaoMs)]
    pub fn duracao_ms(&self) -> i32 {
        self.beatmap.notas.iter().map(|n| n.fim_ms.unwrap_or(n.tempo_ms)).max().unwrap_or(0)
    }
    /// Pontos de BPM e de velocidade em trios [tempo, duração da batida (NaN se não muda o BPM), velocidade].
    #[wasm_bindgen(js_name = pontosDeTempo)]
    pub fn pontos_de_tempo(&self) -> Vec<f64> {
        self.beatmap
            .pontos_de_tempo
            .iter()
            .flat_map(|p| [p.tempo_ms, p.batida_ms.unwrap_or(f64::NAN), p.velocidade])
            .collect()
    }
}

#[wasm_bindgen(js_name = hashDoBeatmap)]
pub fn hash_do_beatmap(bytes: &[u8]) -> String {
    motor::hash_do_beatmap(bytes)
}

/// Confere se a combinação de mods é válida; devolve a mensagem do problema, ou `undefined`.
#[wasm_bindgen(js_name = problemaDosMods)]
pub fn problema_dos_mods(mods: u32) -> Option<String> {
    match motor::Mods(mods).validar() {
        Ok(()) => None,
        Err(motor::ErroDosMods::Conflito(a, b)) => Some(format!("{a} e {b} não podem ser usados juntos.")),
        Err(motor::ErroDosMods::Desconhecido(_)) => Some("Mod desconhecido.".to_string()),
    }
}

#[wasm_bindgen(js_name = multiplicadorDosMods)]
pub fn multiplicador_dos_mods(mods: u32) -> f64 {
    motor::Mods(mods).multiplicador()
}

#[wasm_bindgen(js_name = velocidadeDosMods)]
pub fn velocidade_dos_mods(mods: u32) -> f64 {
    motor::Mods(mods).velocidade()
}

#[wasm_bindgen(js_name = modsValemRanking)]
pub fn mods_valem_ranking(mods: u32) -> bool {
    motor::Mods(mods).vale_ranking()
}

/// Um replay lido pelo motor: o mesmo código que a API usa para rejulgar. O app usa para conferir o que gravou.
#[wasm_bindgen]
pub struct ReplayLido {
    replay: motor::Replay,
}

#[wasm_bindgen]
impl ReplayLido {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8]) -> Result<ReplayLido, JsError> {
        motor::desempacotar_replay(bytes)
            .map(|replay| ReplayLido { replay })
            .map_err(|erro| JsError::new(&format!("Replay inválido: {erro:?}")))
    }
    #[wasm_bindgen(getter)]
    pub fn mods(&self) -> u32 {
        self.replay.mods.0
    }
    #[wasm_bindgen(getter)]
    pub fn semente(&self) -> u32 {
        self.replay.semente
    }
    #[wasm_bindgen(getter)]
    pub fn hash(&self) -> String {
        self.replay.hash.clone()
    }
    /// As entradas em trios [tempo, coluna, 1 = toca / 0 = solta].
    pub fn entradas(&self) -> Vec<i32> {
        self.replay
            .entradas
            .iter()
            .flat_map(|e| [e.tempo_ms, i32::from(e.coluna), i32::from(e.toca)])
            .collect()
    }
}

#[wasm_bindgen]
pub struct MotorDoMania {
    partida: motor::Partida,
}

#[wasm_bindgen]
impl MotorDoMania {
    #[wasm_bindgen(constructor)]
    pub fn new(texto: &str, mods: u32, semente: u32) -> Result<MotorDoMania, JsError> {
        let beatmap = motor::ler_beatmap(texto).map_err(erro_do_beatmap)?;
        let mods = motor::Mods(mods);
        mods.validar().map_err(|_| JsError::new("Combinação de mods inválida."))?;
        Ok(MotorDoMania {
            partida: motor::criar_partida(&beatmap, motor::OpcoesDaPartida { mods, semente }),
        })
    }

    #[wasm_bindgen(getter)]
    pub fn teclas(&self) -> u8 {
        self.partida.teclas
    }

    /// As notas em trios [coluna, tempo, fim (-1 se é simples)], já no tempo real e com as colunas dos mods.
    pub fn notas(&self) -> Vec<i32> {
        self.partida
            .notas
            .iter()
            .flat_map(|n| [i32::from(n.coluna), n.tempo_ms, n.fim_ms.unwrap_or(-1)])
            .collect()
    }

    /// Janelas no tempo real: [MAX, 300, 200, 100, 50, Miss].
    pub fn janelas(&self) -> Vec<f64> {
        let j = self.partida.janelas;
        vec![j.max, j.j300, j.j200, j.j100, j.j50, j.miss]
    }

    /// Devolve o código do julgamento, ou -1 se o toque não acertou nada.
    pub fn tocar(&mut self, coluna: u8, tempo_ms: i32) -> i32 {
        motor::tocar(&mut self.partida, coluna, tempo_ms).map_or(-1, codigo)
    }

    pub fn soltar(&mut self, coluna: u8, tempo_ms: i32) -> i32 {
        motor::soltar(&mut self.partida, coluna, tempo_ms).map_or(-1, codigo)
    }

    pub fn avancar(&mut self, tempo_ms: i32) {
        motor::avancar(&mut self.partida, tempo_ms);
    }

    /// Os julgamentos desde a última chamada, em grupos de cinco: [nota, coluna, julgamento, ponta (0/1), desvio (NaN sem toque)].
    pub fn eventos(&mut self) -> Vec<f64> {
        motor::retirar_eventos(&mut self.partida)
            .into_iter()
            .filter_map(|evento| match evento {
                motor::Evento::Julgamento {
                    nota,
                    coluna,
                    julgamento,
                    ponta,
                    desvio_ms,
                } => Some([
                    nota as f64,
                    f64::from(coluna),
                    f64::from(codigo(julgamento)),
                    f64::from(u8::from(ponta)),
                    desvio_ms.map_or(f64::NAN, f64::from),
                ]),
                motor::Evento::Derrota => None,
            })
            .flatten()
            .collect()
    }

    /// Quantos de cada julgamento, de MAX a Miss.
    pub fn contagem(&self) -> Vec<u32> {
        self.partida.contagem.to_vec()
    }

    pub fn precisao(&self) -> f64 {
        motor::precisao(&self.partida)
    }

    pub fn pontuacao(&self) -> u32 {
        motor::pontuacao(&self.partida)
    }

    /// A nota final pela precisão: "SS", "S", "A", "B", "C" ou "D".
    pub fn classificacao(&self) -> String {
        format!("{:?}", motor::classificacao(motor::precisao(&self.partida)))
    }

    #[wasm_bindgen(getter)]
    pub fn combo(&self) -> u32 {
        self.partida.combo
    }

    #[wasm_bindgen(getter, js_name = maiorCombo)]
    pub fn maior_combo(&self) -> u32 {
        self.partida.maior_combo
    }

    #[wasm_bindgen(getter)]
    pub fn vida(&self) -> f64 {
        self.partida.vida
    }

    #[wasm_bindgen(getter)]
    pub fn derrota(&self) -> bool {
        self.partida.derrota
    }

    pub fn terminou(&self) -> bool {
        motor::terminou(&self.partida)
    }

    #[wasm_bindgen(js_name = totalDeJulgamentos)]
    pub fn total_de_julgamentos(&self) -> u32 {
        motor::total_de_julgamentos(&self.partida)
    }
}
