import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const devOn = process.env.LEGAL_DEV_LOGIN === "1";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Legal Graduu</h1>
        <p className="mt-1 text-sm opacity-70">Assessoria jurídica para polos EAD</p>
      </div>
      {devOn ? (
        <LoginForm />
      ) : (
        <p className="text-center text-sm opacity-80">
          Acesse pelo Hub Graduu. Você será redirecionado após entrar na sua conta.
        </p>
      )}
    </main>
  );
}
