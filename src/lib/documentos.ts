import "server-only";
import { and, asc, desc, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documentos } from "@/db/schema";
import { escopoClientes, type Sessao } from "./session";

/** Documentos do Compliance (processoId null = não é peça de processo), cercados. */
export async function listarDocumentos(s: Sessao) {
  const esc = escopoClientes(s);
  if (esc && esc.length === 0) return [];
  const cerca = esc ? inArray(documentos.clienteId, esc) : undefined;
  return db
    .select()
    .from(documentos)
    .where(
      and(
        cerca,
        isNull(documentos.processoId),
        isNull(documentos.substituidoPorId), // só a versão atual
        isNull(documentos.arquivadoEm), // não arquivado
      ),
    )
    .orderBy(asc(documentos.categoria), desc(documentos.criadoEm));
}
