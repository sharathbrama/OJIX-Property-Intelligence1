import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, ShieldAlert } from "lucide-react";

const LAST_ACTIVITY_KEY = "ojix_owner_last_activity";
const SESSION_EVENT_KEY = "ojix_session_event";
const DEFAULT_IDLE_MS = 5 * 60 * 1000;
const DEFAULT_WARNING_SECONDS = 30;

export function ownerInactivityState(
  lastActivity: number,
  now: number,
  idleMs = DEFAULT_IDLE_MS,
  warningSeconds = DEFAULT_WARNING_SECONDS,
) {
  const elapsed = Math.max(0, now - lastActivity);
  if (elapsed < idleMs) return { phase: "active" as const, seconds: warningSeconds };
  const seconds = Math.max(0, Math.ceil((idleMs + warningSeconds * 1000 - elapsed) / 1000));
  return { phase: seconds > 0 ? ("warning" as const) : ("expired" as const), seconds };
}

export default function OwnerInactivityGuard({ onExpire, apiUrl = "" }: { onExpire: () => void; apiUrl?: string }) {
  const idleMs = Number(import.meta.env.VITE_OWNER_INACTIVITY_MS) || DEFAULT_IDLE_MS;
  const warningSeconds = Number(import.meta.env.VITE_OWNER_WARNING_SECONDS) || DEFAULT_WARNING_SECONDS;
  const [warning, setWarning] = useState(false);
  const [seconds, setSeconds] = useState(warningSeconds);
  const lastActivity = useRef(Date.now());
  const lastLocalWrite = useRef(0);
  const lastServerPing = useRef(0);
  const expired = useRef(false);

  const pingServer = useCallback(() => {
    const now = Date.now();
    if (now - lastServerPing.current < 20_000) return;
    lastServerPing.current = now;
    const token = localStorage.getItem("ojix_auth_token");
    if (!token) return;
    fetch(`${apiUrl}/api/auth/activity`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {});
  }, [apiUrl]);

  const recordActivity = useCallback((broadcast = true) => {
    if (warning || expired.current) return;
    const now = Date.now();
    lastActivity.current = now;
    if (broadcast && now - lastLocalWrite.current >= 1_000) {
      lastLocalWrite.current = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }
    pingServer();
  }, [pingServer, warning]);

  const continueSession = () => {
    const now = Date.now();
    expired.current = false;
    lastActivity.current = now;
    lastLocalWrite.current = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    setWarning(false);
    setSeconds(warningSeconds);
    lastServerPing.current = 0;
    pingServer();
  };

  useEffect(() => {
    const now = Date.now();
    const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    lastActivity.current = Number.isFinite(stored) && now - stored < idleMs ? stored : now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity.current));
    pingServer();

    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    const activityHandler = () => recordActivity();
    activityEvents.forEach((eventName) => window.addEventListener(eventName, activityHandler, { passive: true }));

    const storageHandler = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        const timestamp = Number(event.newValue);
        if (Number.isFinite(timestamp) && timestamp > lastActivity.current) {
          lastActivity.current = timestamp;
          setWarning(false);
          setSeconds(warningSeconds);
        }
      }
      if (event.key === SESSION_EVENT_KEY && event.newValue) {
        try {
          const message = JSON.parse(event.newValue);
          if (message.type === "logout" && !expired.current) {
            expired.current = true;
            onExpire();
          }
        } catch {}
      }
    };
    window.addEventListener("storage", storageHandler);

    const timer = window.setInterval(() => {
      const state = ownerInactivityState(lastActivity.current, Date.now(), idleMs, warningSeconds);
      if (state.phase === "warning") {
        setWarning(true);
        setSeconds(state.seconds);
      } else if (state.phase === "expired" && !expired.current) {
        expired.current = true;
        localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({ type: "logout", reason: "inactivity", at: Date.now() }));
        onExpire();
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, activityHandler));
      window.removeEventListener("storage", storageHandler);
    };
  }, [idleMs, onExpire, pingServer, recordActivity, warningSeconds]);

  if (!warning) return null;
  return <div className="owner-inactivity-backdrop" role="presentation">
    <section className="owner-inactivity-modal" role="alertdialog" aria-modal="true" aria-labelledby="owner-inactivity-title" aria-describedby="owner-inactivity-copy">
      <span className="owner-inactivity-icon"><ShieldAlert /></span>
      <small>SESSION SECURITY</small>
      <h2 id="owner-inactivity-title">Are you still using OJIX Property Intelligence?</h2>
      <p id="owner-inactivity-copy">Your workspace will be signed out automatically unless you continue this session.</p>
      <div className="owner-inactivity-countdown"><Clock3 /><strong>{seconds}</strong><span>seconds remaining</span></div>
      <div className="owner-inactivity-progress" aria-hidden="true"><i style={{ width: `${seconds / warningSeconds * 100}%` }} /></div>
      <button type="button" autoFocus onClick={continueSession}>Continue Session</button>
    </section>
  </div>;
}
