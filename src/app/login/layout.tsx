import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar · WevyFlow",
  description: "Acesse sua conta WevyFlow",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* allow scrolling on short viewports (globals.css locks overflow:hidden for the editor app) */}
      <style>{`body { overflow: auto !important; }`}</style>
      {children}
    </>
  );
}
