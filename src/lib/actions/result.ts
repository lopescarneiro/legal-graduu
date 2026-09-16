/** Resultado padrão de uma server action de formulário (convenção da suíte). */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };
