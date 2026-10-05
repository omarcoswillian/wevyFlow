import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

export type MetaDeletionKind = "deletion" | "deauthorize";

/** Apaga o que a WevyFlow guarda de um usuário Meta (id escopado ao app, o
 * mesmo `me.id` gravado em meta_ads_connections.meta_user_id): a conexão
 * (token + conta escolhida) e tudo que veio da Marketing API
 * (ad_watch_creatives com source = meta_ads_api). Vale tanto pra exclusão
 * quanto pra desautorização — remover o app não deve deixar dados pra trás.
 *
 * Tudo roda na função SQL delete_meta_user_data (uma transação, com lock por
 * id Meta). Idempotente: sem nada a apagar ainda devolve um código válido,
 * pois a Meta exige resposta mesmo assim. */
export async function deleteMetaUserData(metaUserId: string, kind: MetaDeletionKind) {
  const confirmationCode = randomBytes(16).toString("hex");
  const { data, error } = await createServiceClient().rpc("delete_meta_user_data", {
    p_meta_user_id: metaUserId,
    p_kind: kind,
    p_confirmation_code: confirmationCode,
  });
  if (error) throw new Error(error.message);
  return { confirmationCode, connectionsDeleted: data as number };
}
