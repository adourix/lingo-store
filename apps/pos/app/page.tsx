import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PosShell from "./PosShell";

const TERMINAL_COOKIE = "__Host-lingo_terminal";
const SESSION_COOKIE = "__Host-lingo_pos_sid";

export default async function Home() {
  const jar = await cookies();
  const hasTerminal = jar.has(TERMINAL_COOKIE);
  const hasSession = jar.has(SESSION_COOKIE);

  if (!hasTerminal) redirect("/enroll");
  if (!hasSession) redirect("/login");

  return <PosShell mode="pos" />;
}
