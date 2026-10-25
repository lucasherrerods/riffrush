export type Documento = "privacidade" | "termos";

interface Secao {
  titulo: string;
  paragrafos: string[];
}

interface ConteudoDoDocumento {
  titulo: string;
  atualizadoEm: string;
  secoes: Secao[];
}

export const EMAIL_DE_CONTATO = "riffrushdasilva@gmail.com";

export const DOCUMENTOS: Record<Documento, ConteudoDoDocumento> = {
  privacidade: {
    titulo: "Política de Privacidade",
    atualizadoEm: "25 de outubro de 2026",
    secoes: [
      {
        titulo: "Resumo",
        paragrafos: [
          "Dá para jogar o Riff Rush sem conta. A conta é opcional e serve só para guardar o seu nível e o seu XP. Não vendemos dados, não mostramos anúncios, não pedimos sua senha e não mandamos e-mails.",
        ],
      },
      {
        titulo: "O que guardamos no servidor",
        paragrafos: [
          "Só quando você entra com o Google: o identificador da sua conta Google, o seu nome, o seu e-mail e o endereço da sua foto de perfil, como o Google nos informa. O e-mail aparece só para você, no menu da conta e no perfil.",
          "O seu XP total e o resumo de cada partida: música, instrumento, dificuldade, pontos, acertos, total de notas, se foi vaiado e a data.",
          "As sessões de login, guardadas como um código embaralhado (hash) que vale por 30 dias. O código original fica só no seu aparelho.",
          "Se você ligar o chat global: as mensagens que manda, com o seu nome e o identificador da conta, ficam no servidor das salas online (Cloudflare) por até 24 horas, no máximo as 50 últimas do chat.",
          "Quando alguém denuncia uma mensagem, uma cópia dela (autor, texto e hora), com quem denunciou, fica guardada no nosso banco de dados para a equipe analisar até ser resolvida. Se a equipe banir a sua conta do chat, isso também fica no banco, ligado à sua conta.",
        ],
      },
      {
        titulo: "O que fica só no seu aparelho",
        paragrafos: [
          "Configurações, personagem, recordes e as músicas que você importa ficam salvos no próprio navegador ou no app, e não são enviados para nós.",
          "No multijogador, o seu apelido, o personagem, a pontuação e as mensagens do chat da sala passam pelo servidor da sala só enquanto ela está aberta. Nada disso é guardado.",
          "A lista de pessoas que você silenciou no chat global fica só no seu aparelho.",
        ],
      },
      {
        titulo: "Para que usamos",
        paragrafos: [
          "Para fazer o login, mostrar com qual conta Google você entrou, calcular e mostrar o seu nível e o XP de cada partida e evitar trapaças, como partidas impossíveis ou enviadas rápido demais. A base legal é a execução do serviço que você pediu ao criar a conta (LGPD, art. 7º, V).",
        ],
      },
      {
        titulo: "Com quem compartilhamos",
        paragrafos: [
          "Com ninguém para fins comerciais. Usamos serviços que hospedam o jogo e processam os dados por nós: Google (login), Render (servidor da API), Neon (banco de dados), Vercel (site) e Cloudflare (salas online). Alguns ficam fora do Brasil, principalmente nos Estados Unidos, e seguem as próprias regras de proteção de dados.",
        ],
      },
      {
        titulo: "Por quanto tempo",
        paragrafos: [
          "Enquanto a sua conta existir. Quando você a exclui, a conta, as sessões, o histórico de partidas, as denúncias que envolvem você e um banimento do chat são apagados na hora. As mensagens do chat global somem sozinhas em até 24 horas.",
        ],
      },
      {
        titulo: "Seus direitos",
        paragrafos: [
          "Pela LGPD, você pode pedir acesso, correção ou exclusão dos seus dados. Para apagar tudo, use o botão Excluir minha conta no fim desta página, com a conta conectada.",
          `Para qualquer outro pedido ou dúvida, escreva para ${EMAIL_DE_CONTATO}.`,
        ],
      },
      {
        titulo: "Mudanças",
        paragrafos: ["Se esta política mudar, a data no topo é atualizada. Mudanças importantes também serão avisadas dentro do jogo."],
      },
    ],
  },
  termos: {
    titulo: "Termos de Uso",
    atualizadoEm: "25 de outubro de 2026",
    secoes: [
      {
        titulo: "O jogo",
        paragrafos: [
          "O Riff Rush é um jogo de ritmo gratuito e de código aberto. Ao jogar, você concorda com estes termos. Se não concordar, não use o jogo.",
        ],
      },
      {
        titulo: "Conta",
        paragrafos: [
          "A conta é opcional e usa o login do Google. Você é responsável pelo que acontece com ela. Você pode excluí-la quando quiser, como explicado na Política de Privacidade.",
        ],
      },
      {
        titulo: "Jogo limpo",
        paragrafos: [
          "Não tente enganar o servidor para ganhar XP, não ataque nem sobrecarregue os servidores e não use o multijogador para incomodar outras pessoas. Contas que fizerem isso podem ter o XP zerado ou ser excluídas.",
        ],
      },
      {
        titulo: "Chat",
        paragrafos: [
          "O chat global é público para quem tem conta, e escrever nele pede o nível 2. O chat da sala é visto por quem estiver na sala.",
          "Não passe dados pessoais seus nem de outras pessoas. A equipe nunca pede senha: só fala por ela quem aparece com o selo Equipe.",
          "Proibido ofender, assediar, ameaçar, discriminar, mandar spam, divulgar golpes ou conteúdo ilegal ou sexual. Mensagens assim podem ser apagadas e a conta pode ser banida do chat, ou excluída.",
          "Você pode silenciar e denunciar qualquer mensagem. As denúncias vão para a equipe.",
        ],
      },
      {
        titulo: "Músicas",
        paragrafos: [
          "As músicas que vêm com o jogo seguem as licenças dos seus autores. As músicas que você importa ou baixa são de sua responsabilidade: use apenas as que você tem direito de usar.",
        ],
      },
      {
        titulo: "Sem garantia",
        paragrafos: [
          "O jogo é oferecido do jeito que está. Ele pode ter falhas, ficar fora do ar ou mudar, e o progresso da conta pode ser perdido por problemas técnicos. Não nos responsabilizamos por danos causados pelo uso do jogo, nos limites da lei.",
        ],
      },
      {
        titulo: "Mudanças e contato",
        paragrafos: [
          "Estes termos podem mudar, e a data no topo mostra a versão atual. Eles seguem as leis do Brasil.",
          `Dúvidas: ${EMAIL_DE_CONTATO}.`,
        ],
      },
    ],
  },
};

/** O site aceita /privacidade e /termos como endereços diretos, que são os links que o Google mostra no login. */
export function documentoDoEndereco(caminho: string): Documento | null {
  const nome = caminho.replace(/^\/+|\/+$/g, "");
  return nome === "privacidade" || nome === "termos" ? nome : null;
}
