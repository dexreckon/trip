"use client";
import { authClient, useSession } from "../lib/client";
export default function Nav({ admin = false }) {
  const { session } = useSession();
  return (
    <header>
      <a className="brand" href="/">
        △{" "}
        <span>
          TRAIL CLUB<small>THE UNIVERSITY OUTDOORS</small>
        </span>
      </a>
      <nav>
        <a href="/dashboard">My trip</a>
        {admin && <a href="/admin">Organizer desk</a>}
        {session ? (
          <button
            className="text-button"
            onClick={async () => {
              await authClient().auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sign out
          </button>
        ) : (
          <a href="/login">Sign in ↗</a>
        )}
      </nav>
    </header>
  );
}
