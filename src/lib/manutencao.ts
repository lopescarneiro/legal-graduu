import "server-only";

/**
 * Flag de manutenção (congela o sistema para todos). No MVP é um stub FAIL-OPEN:
 * sem backend configurado, o sistema nunca está em manutenção. Plugar Upstash
 * (como no atende/matriculador) quando necessário.
 */
export async function checarManutencao(): Promise<{ ativo: boolean } | null> {
  return null;
}
