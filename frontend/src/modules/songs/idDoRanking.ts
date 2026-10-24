import type { Musica } from "./tipos";

/** Como a música é reconhecida no ranking: o mesmo chart precisa ter o mesmo id em qualquer aparelho. */
export const idDoRanking = (musica: Pick<Musica, "id" | "md5DoEncore">) => (musica.md5DoEncore ? `encore:${musica.md5DoEncore}` : musica.id);
