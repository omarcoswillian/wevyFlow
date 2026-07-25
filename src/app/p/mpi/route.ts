import { readFileSync } from "fs";
import { join } from "path";

const TEMPLATE_PATH = join(process.cwd(), "src/app/lib/ready-templates/mpi-metodo-par-ideal.html");

export async function GET() {
  const html = readFileSync(TEMPLATE_PATH, "utf-8");
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
