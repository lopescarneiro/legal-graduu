import { LoginForm } from "./login-form";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const provider =
    process.env.LEGAL_DEV_LOGIN === "1"
      ? "dev"
      : process.env.LEGAL_PREVIEW_LOGIN === "on"
        ? "preview"
        : null;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-brand">Legal Graduu</h1>
        <p className="mt-1 text-sm text-muted">Assessoria jurídica para polos EAD</p>
      </div>
      <Card className="w-full p-6">
        {provider ? (
          <LoginForm provider={provider} />
        ) : (
          <p className="text-center text-sm text-ink2">
            Acesse pelo Hub Graduu. Você será redirecionado após entrar na sua conta.
          </p>
        )}
      </Card>
    </main>
  );
}
