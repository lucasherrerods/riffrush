//! A sugestão de música em JSON, no formato que o banco guarda e o relay entrega (o mesmo da API).

use serde_json::{json, Value};

use super::dominio::{ModoDaSugestao, SugestaoDeMusica};

pub fn sugestao_em_json(sugestao: &SugestaoDeMusica) -> Value {
    json!({
        "modo": sugestao.modo.como_texto(),
        "musica": sugestao.musica,
        "versao": sugestao.versao,
        "titulo": sugestao.titulo,
        "artista": sugestao.artista,
        "dificuldade": sugestao.dificuldade,
    })
}

pub fn sugestao_do_json(valor: &Value) -> Option<SugestaoDeMusica> {
    let texto = |campo: &str| valor.get(campo).and_then(Value::as_str).map(String::from);
    Some(SugestaoDeMusica {
        modo: ModoDaSugestao::do_texto(valor.get("modo")?.as_str()?)?,
        musica: texto("musica")?,
        versao: texto("versao"),
        titulo: texto("titulo")?,
        artista: texto("artista").unwrap_or_default(),
        dificuldade: texto("dificuldade").unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sugestao_vai_e_volta_do_json() {
        let sugestao = SugestaoDeMusica {
            modo: ModoDaSugestao::Rock,
            musica: "fb0079d4c2e025d5b8dd70724750a923".into(),
            versao: None,
            titulo: "Riff".into(),
            artista: "Banda".into(),
            dificuldade: "Expert".into(),
        };
        assert_eq!(sugestao_do_json(&sugestao_em_json(&sugestao)), Some(sugestao));
        assert_eq!(sugestao_do_json(&json!({ "modo": "outro", "musica": "1", "titulo": "x" })), None);
    }
}
