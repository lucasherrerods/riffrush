//! O motor da partida para o app, em WASM: o mesmo código que a API usa para rejulgar os replays.
//! O app guarda um espelho do estado em objetos JS (para o desenho e o HUD lerem direto) e, depois de
//! cada mudança, pede `sincronizar`, que devolve só o que mudou num único Float64Array.

use riffrush_motor as motor;
use wasm_bindgen::prelude::*;

const ACERTADA: u8 = 1;
const PERDIDA: u8 = 2;
const SEGURANDO: u8 = 4;
const SOLTA: u8 = 8;

fn codigo_do_julgamento(julgamento: motor::Julgamento) -> f64 {
    match julgamento {
        motor::Julgamento::Perfeito => 0.0,
        motor::Julgamento::Otimo => 1.0,
        motor::Julgamento::Bom => 2.0,
    }
}

fn bandeiras(nota: &motor::NotaEmJogo) -> u8 {
    (u8::from(nota.acertada) * ACERTADA) | (u8::from(nota.perdida) * PERDIDA) | (u8::from(nota.segurando) * SEGURANDO) | (u8::from(nota.solta) * SOLTA)
}

#[wasm_bindgen]
pub struct MotorDaPartida {
    partida: motor::Partida,
    /// O que o app já tem de cada nota (bandeiras e até onde o sustain rendeu), para mandar só o que mudou.
    enviadas: Vec<(u8, f64)>,
    frases_enviadas: Vec<i32>,
    /// A primeira nota que ainda importava na última sincronização: antes dela nada muda mais.
    primeira_enviada: usize,
    /// Notas acertadas direto pelo app (o bot), que podem estar fora da janela que a sincronização olha.
    forcadas: Vec<usize>,
}

#[wasm_bindgen]
impl MotorDaPartida {
    /// As notas vêm em quatro listas paralelas, que passam para o WASM sem um objeto por nota.
    // O wasm-bindgen só aceita argumentos soltos no construtor, sem um struct de opções.
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn new(
        tempos: &[f64],
        pistas: &[u8],
        frases: &[i32],
        duracoes: &[f64],
        sem_falha: bool,
        fantasma: bool,
        velocidade: f64,
        sem_aberta: bool,
        jeito: u8,
        pune_toque_em_vazio: bool,
    ) -> MotorDaPartida {
        let notas: Vec<motor::Nota> = tempos
            .iter()
            .zip(pistas)
            .zip(frases)
            .zip(duracoes)
            .map(|(((&tempo, &pista), &frase), &duracao)| motor::Nota { tempo, pista, frase, duracao })
            .collect();
        let partida = motor::criar_partida(
            &notas,
            motor::OpcoesDaPartida {
                sem_falha,
                fantasma,
                velocidade,
                sem_aberta,
                // A mesma ordem dos bits do replay.
                jeito: match jeito {
                    1 => motor::JeitoDeJogar::Tapping,
                    2 => motor::JeitoDeJogar::Palhetada,
                    _ => motor::JeitoDeJogar::Gamepad,
                },
                pune_toque_em_vazio,
            },
        );
        let enviadas = partida.notas.iter().map(|n| (bandeiras(n), n.segurou_ate)).collect();
        MotorDaPartida {
            partida,
            enviadas,
            frases_enviadas: Vec::new(),
            primeira_enviada: 0,
            forcadas: Vec::new(),
        }
    }

    /// Tempo e duração de cada nota já no tempo real (dividido pela velocidade) e na grade da partida,
    /// e a pista em que ela de fato cai (sem a aberta, a aberta vira verde), para o espelho começar igual.
    pub fn grade_das_notas(&self) -> Vec<f64> {
        self.partida.notas.iter().flat_map(|n| [n.tempo, n.duracao, f64::from(n.pista)]).collect()
    }

    pub fn tocar(&mut self, pista: u8, tempo: f64) -> bool {
        motor::tocar(&mut self.partida, pista, tempo)
    }

    pub fn soltar(&mut self, pista: u8, tempo: f64) {
        motor::soltar(&mut self.partida, pista, tempo);
    }

    pub fn palhetar(&mut self, tempo: f64) -> bool {
        motor::palhetar(&mut self.partida, tempo)
    }

    pub fn avancar(&mut self, tempo: f64) {
        motor::avancar(&mut self.partida, tempo);
    }

    pub fn ativar_estrela(&mut self) -> bool {
        motor::ativar_estrela(&mut self.partida)
    }

    pub fn acertar(&mut self, indice: usize, tempo: f64) {
        if indice < self.partida.notas.len() {
            motor::acertar(&mut self.partida, indice, tempo);
            self.forcadas.push(indice);
        }
    }

    pub fn precisao(&self) -> f64 {
        motor::precisao(&self.partida)
    }

    pub fn multiplicador(&self) -> f64 {
        motor::multiplicador(&self.partida)
    }

    /// O que mudou desde a última chamada, na ordem:
    /// - 19 números do estado: tempo (NaN antes de começar), pontos, sequência, maior sequência, acertos,
    ///   perfeitos, ótimos, bons, valor dos acertos, erros, vida, ticks de star power, barra de star power (0 a 1),
    ///   star power ativo, derrota, fantasma, a primeira nota que ainda importa, o multiplicador e a precisão;
    /// - quantas notas mudaram e, para cada uma, índice, bandeiras e até onde o sustain rendeu;
    /// - quantos eventos e, para cada um, código e dois valores;
    /// - quantas frases falharam e cada uma.
    pub fn sincronizar(&mut self) -> Vec<f64> {
        let p = &self.partida;
        let mut saida = vec![
            p.tempo.unwrap_or(f64::NAN),
            p.pontos,
            f64::from(p.sequencia),
            f64::from(p.maior_sequencia),
            f64::from(p.acertos),
            f64::from(p.perfeitos),
            f64::from(p.otimos),
            f64::from(p.bons),
            f64::from(p.valor_dos_acertos),
            f64::from(p.erros),
            p.vida,
            p.estrela_em_ticks,
            motor::estrela(p),
            f64::from(u8::from(p.estrela_ativa)),
            f64::from(u8::from(p.derrota)),
            f64::from(u8::from(p.fantasma)),
            p.primeira as f64,
            motor::multiplicador(p),
            motor::precisao(p),
        ];

        let posicao_da_contagem = saida.len();
        saida.push(0.0);
        let mut mudadas = 0.0;
        let mut conferir = |indice: usize, saida: &mut Vec<f64>| {
            let nota = &p.notas[indice];
            let atual = (bandeiras(nota), nota.segurou_ate);
            let enviada = &mut self.enviadas[indice];
            if atual != *enviada {
                *enviada = atual;
                saida.extend([indice as f64, f64::from(atual.0), atual.1]);
                mudadas += 1.0;
            }
        };
        // Só muda o que está entre a primeira nota que ainda importava e o fim da janela de acerto:
        // as de trás já foram julgadas e as da frente ainda não chegaram. Percorrer a música toda a cada toque pesa.
        let limite = p.tempo.map_or(f64::NEG_INFINITY, |t| t + motor::JANELA_DE_ACERTO + 0.001);
        let inicio = self.primeira_enviada.min(p.primeira);
        let mut indice = inicio;
        while indice < p.notas.len() && p.notas[indice].tempo <= limite {
            conferir(indice, &mut saida);
            indice += 1;
        }
        for forcada in std::mem::take(&mut self.forcadas) {
            if forcada < inicio || forcada >= indice {
                conferir(forcada, &mut saida);
            }
        }
        self.primeira_enviada = p.primeira;
        saida[posicao_da_contagem] = mudadas;

        let eventos = motor::retirar_eventos(&mut self.partida);
        saida.push(eventos.len() as f64);
        for evento in eventos {
            saida.extend(match evento {
                motor::Evento::Acerto { nota, julgamento } => [0.0, nota as f64, codigo_do_julgamento(julgamento)],
                motor::Evento::Erro { nota } => [1.0, nota as f64, 0.0],
                motor::Evento::Sequencia(valor) => [2.0, f64::from(valor), 0.0],
                motor::Evento::FraseCompleta => [3.0, 0.0, 0.0],
                motor::Evento::EstrelaPronta => [4.0, 0.0, 0.0],
                motor::Evento::EstrelaAtivada => [5.0, 0.0, 0.0],
                motor::Evento::Derrota => [6.0, 0.0, 0.0],
                motor::Evento::VirouFantasma => [7.0, 0.0, 0.0],
                // Na palheta não há traste: vai como -1.
                motor::Evento::ToqueEmVazio { pista } => [8.0, pista.map_or(-1.0, f64::from), 0.0],
            });
        }

        let novas: Vec<i32> = self
            .partida
            .frases_falhas
            .iter()
            .copied()
            .filter(|f| !self.frases_enviadas.contains(f))
            .collect();
        saida.push(novas.len() as f64);
        saida.extend(novas.iter().map(|&f| f64::from(f)));
        self.frases_enviadas.extend(novas);
        saida
    }
}

/// O tempo arredondado para a grade da partida (1 ms).
#[wasm_bindgen]
pub fn quantizar(tempo: f64) -> f64 {
    motor::quantizar(tempo)
}

/// 0 é perfeito, 1 ótimo e 2 bom.
#[wasm_bindgen]
pub fn julgar(distancia: f64) -> f64 {
    codigo_do_julgamento(motor::julgar(distancia))
}

#[wasm_bindgen]
pub fn janela_de_acerto() -> f64 {
    motor::JANELA_DE_ACERTO
}

/// As velocidades da música que o jogo oferece.
#[wasm_bindgen]
pub fn velocidades() -> Vec<f64> {
    motor::VELOCIDADES.to_vec()
}
