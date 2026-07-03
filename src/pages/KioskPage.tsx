import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import RHRelogioPonto from "./RHRelogioPonto";

export default function KioskPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setAuthed(!!token);
    if (token) localStorage.setItem("kiosk_mode", "1");
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!authed) return <Navigate to="/kiosk/login" replace />;

  return <RHRelogioPonto kiosk />;
}
