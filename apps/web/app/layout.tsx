import type { ReactNode } from "react";import CsrfBootstrap from "./csrf-bootstrap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><CsrfBootstrap/>{children}</body></html>;
}
