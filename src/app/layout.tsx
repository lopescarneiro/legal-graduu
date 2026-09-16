import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

// NOTA: a suíte usa Montserrat via `next/font/google`. Para o deploy real (Vercel, com
// rede) restaurar:  import { Montserrat } from "next/font/google";
//   const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
//   e <html className={montserrat.variable}>. Aqui usamos a pilha de fallback do globals.css.

export const metadata: Metadata = {
  title: "Legal Graduu",
  description:
    "Assessoria jurídica por assinatura para polos EAD — powered by Verônica Gilioli Advogados.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
