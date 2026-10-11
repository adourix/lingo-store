"use client";

import PosShell from "./PosShell";

export default function Home() {
  // PosShell owns the single auth/bootstrap request for the POS root.
  // Keeping auth here as well caused a duplicate /api/pos/auth/me request and
  // a race where the temporary loading screen could redirect before the shell
  // finished initializing.
  return <PosShell mode="pos" />;
}
