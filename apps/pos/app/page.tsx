"use client";

import { useEffect, useState } from "react";
import PosShell from "./PosShell";
import { readState, type DeviceState } from "../lib/store";

export default function Home() {
  const [state, setState] = useState<DeviceState | null>(null);

  useEffect(() => {
    let active = true;
    void readState().then((next) => {
      if (!active) return;
      if (!next.user) {
        window.location.replace("/login");
        return;
      }
      if (!next.terminal) {
        window.location.replace("/enroll");
        return;
      }
      setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!state)
    return (
      <main className="pos-center">
        <div className="pos-card">
          <p>Loading terminal…</p>
        </div>
      </main>
    );

  return <PosShell mode="pos" />;
}
