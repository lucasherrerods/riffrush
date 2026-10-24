//! As músicas importadas no PC: os dados ficam numa SQLite e os arquivos numa pasta do app.
//! Aqui não existe limite de fila: o disco do PC guarda todas.

use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Uma música salva. `dados` é o JSON da música do front, sem os arquivos.
#[derive(Serialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Registro {
    pub id: String,
    pub dados: String,
    pub usada_em: i64,
    pub nome_do_arquivo: String,
    pub tipo_do_arquivo: String,
    pub tem_capa: bool,
}

pub struct Novo<'a> {
    pub id: &'a str,
    pub dados: &'a str,
    pub nome_do_arquivo: &'a str,
    pub tipo_do_arquivo: &'a str,
    pub arquivo: &'a [u8],
}

pub struct Armazem {
    banco: Connection,
    pasta: PathBuf,
}

const ARQUIVO: &str = "arquivo";
const CAPA: &str = "capa";

/// FNV-1a: o mesmo id sempre dá a mesma pasta, só com letras e números.
fn pasta_do_id(id: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in id.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn erro(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl Armazem {
    pub fn abrir(pasta: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(pasta.join("musicas")).map_err(erro)?;
        let banco = Connection::open(pasta.join("biblioteca.db")).map_err(erro)?;
        banco
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS musicas (
                    id TEXT PRIMARY KEY,
                    dados TEXT NOT NULL,
                    usada_em INTEGER NOT NULL,
                    nome_do_arquivo TEXT NOT NULL,
                    tipo_do_arquivo TEXT NOT NULL
                )",
            )
            .map_err(erro)?;
        Ok(Self { banco, pasta: pasta.to_path_buf() })
    }

    fn pasta_da(&self, id: &str) -> PathBuf {
        self.pasta.join("musicas").join(pasta_do_id(id))
    }

    /// Da usada por último para a mais antiga.
    pub fn listar(&self) -> Result<Vec<Registro>, String> {
        let mut consulta = self
            .banco
            .prepare("SELECT id, dados, usada_em, nome_do_arquivo, tipo_do_arquivo FROM musicas ORDER BY usada_em DESC")
            .map_err(erro)?;
        let linhas = consulta
            .query_map([], |linha| {
                Ok(Registro {
                    id: linha.get(0)?,
                    dados: linha.get(1)?,
                    usada_em: linha.get(2)?,
                    nome_do_arquivo: linha.get(3)?,
                    tipo_do_arquivo: linha.get(4)?,
                    tem_capa: false,
                })
            })
            .map_err(erro)?;
        linhas
            .map(|r| r.map(|registro| Registro { tem_capa: self.pasta_da(&registro.id).join(CAPA).exists(), ..registro }).map_err(erro))
            .collect()
    }

    pub fn guardar(&self, novo: Novo, agora: i64) -> Result<(), String> {
        let pasta = self.pasta_da(novo.id);
        std::fs::create_dir_all(&pasta).map_err(erro)?;
        std::fs::write(pasta.join(ARQUIVO), novo.arquivo).map_err(erro)?;
        self.banco
            .execute(
                "INSERT INTO musicas (id, dados, usada_em, nome_do_arquivo, tipo_do_arquivo) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET dados = ?2, usada_em = ?3, nome_do_arquivo = ?4, tipo_do_arquivo = ?5",
                (novo.id, novo.dados, agora, novo.nome_do_arquivo, novo.tipo_do_arquivo),
            )
            .map_err(erro)?;
        Ok(())
    }

    pub fn guardar_capa(&self, id: &str, capa: &[u8]) -> Result<(), String> {
        let pasta = self.pasta_da(id);
        std::fs::create_dir_all(&pasta).map_err(erro)?;
        std::fs::write(pasta.join(CAPA), capa).map_err(erro)
    }

    pub fn usar(&self, id: &str, agora: i64) -> Result<(), String> {
        self.banco.execute("UPDATE musicas SET usada_em = ?1 WHERE id = ?2", (agora, id)).map_err(erro)?;
        Ok(())
    }

    pub fn remover(&self, id: &str) -> Result<(), String> {
        self.banco.execute("DELETE FROM musicas WHERE id = ?1", [id]).map_err(erro)?;
        let pasta = self.pasta_da(id);
        if pasta.exists() {
            std::fs::remove_dir_all(pasta).map_err(erro)?;
        }
        Ok(())
    }

    pub fn ler_arquivo(&self, id: &str) -> Option<Vec<u8>> {
        std::fs::read(self.pasta_da(id).join(ARQUIVO)).ok()
    }

    pub fn ler_capa(&self, id: &str) -> Option<Vec<u8>> {
        std::fs::read(self.pasta_da(id).join(CAPA)).ok()
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    fn pasta_temporaria() -> PathBuf {
        static CONTADOR: AtomicU32 = AtomicU32::new(0);
        let pasta = std::env::temp_dir().join(format!("riffrush-teste-{}-{}", std::process::id(), CONTADOR.fetch_add(1, Ordering::SeqCst)));
        let _ = std::fs::remove_dir_all(&pasta);
        pasta
    }

    fn musica<'a>(id: &'a str, arquivo: &'a [u8]) -> Novo<'a> {
        Novo { id, dados: r#"{"titulo":"Riff"}"#, nome_do_arquivo: "Riff.mp3", tipo_do_arquivo: "audio/mpeg", arquivo }
    }

    #[test]
    fn guarda_e_devolve_depois_de_abrir_de_novo() {
        let pasta = pasta_temporaria();
        Armazem::abrir(&pasta).unwrap().guardar(musica("arquivo:Riff.mp3:3", b"abc"), 1).unwrap();
        let armazem = Armazem::abrir(&pasta).unwrap();
        let registros = armazem.listar().unwrap();
        assert_eq!(registros.len(), 1);
        assert_eq!(registros[0].dados, r#"{"titulo":"Riff"}"#);
        assert_eq!(registros[0].nome_do_arquivo, "Riff.mp3");
        assert_eq!(armazem.ler_arquivo("arquivo:Riff.mp3:3"), Some(b"abc".to_vec()));
    }

    #[test]
    fn guarda_todas_as_musicas_da_usada_por_ultimo_para_a_mais_antiga() {
        let armazem = Armazem::abrir(&pasta_temporaria()).unwrap();
        for (i, id) in ["a", "b", "c", "d", "e"].iter().enumerate() {
            armazem.guardar(musica(id, b"x"), i as i64).unwrap();
        }
        armazem.usar("b", 10).unwrap();
        let ids: Vec<_> = armazem.listar().unwrap().into_iter().map(|r| r.id).collect();
        assert_eq!(ids, ["b", "e", "d", "c", "a"]);
    }

    #[test]
    fn guardar_de_novo_troca_o_arquivo_sem_duplicar() {
        let armazem = Armazem::abrir(&pasta_temporaria()).unwrap();
        armazem.guardar(musica("a", b"velho"), 1).unwrap();
        armazem.guardar(musica("a", b"novo"), 2).unwrap();
        assert_eq!(armazem.listar().unwrap().len(), 1);
        assert_eq!(armazem.ler_arquivo("a"), Some(b"novo".to_vec()));
    }

    #[test]
    fn guarda_a_capa_separada() {
        let armazem = Armazem::abrir(&pasta_temporaria()).unwrap();
        armazem.guardar(musica("a", b"x"), 1).unwrap();
        assert!(!armazem.listar().unwrap()[0].tem_capa);
        armazem.guardar_capa("a", b"png").unwrap();
        assert!(armazem.listar().unwrap()[0].tem_capa);
        assert_eq!(armazem.ler_capa("a"), Some(b"png".to_vec()));
    }

    // O id tem ":" e o nome do arquivo do jogador: não pode virar caminho inválido nem sair da pasta.
    #[test]
    fn ids_com_caracteres_estranhos_viram_pastas_seguras() {
        let pasta = pasta_temporaria();
        let armazem = Armazem::abrir(&pasta).unwrap();
        armazem.guardar(musica("arquivo:../../fora:C:\\x?*.mp3:9", b"x"), 1).unwrap();
        assert_eq!(armazem.ler_arquivo("arquivo:../../fora:C:\\x?*.mp3:9"), Some(b"x".to_vec()));
        assert!(!pasta.parent().unwrap().join("fora").exists());
    }

    #[test]
    fn remover_apaga_o_registro_e_os_arquivos() {
        let armazem = Armazem::abrir(&pasta_temporaria()).unwrap();
        armazem.guardar(musica("a", b"x"), 1).unwrap();
        armazem.guardar_capa("a", b"png").unwrap();
        armazem.remover("a").unwrap();
        assert!(armazem.listar().unwrap().is_empty());
        assert_eq!(armazem.ler_arquivo("a"), None);
        assert_eq!(armazem.ler_capa("a"), None);
    }

    #[test]
    fn usar_uma_musica_que_nao_existe_nao_falha() {
        let armazem = Armazem::abrir(&pasta_temporaria()).unwrap();
        assert!(armazem.usar("nada", 1).is_ok());
    }
}
