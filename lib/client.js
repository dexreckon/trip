"use client";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
let client;
export function authClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    throw Error("The organizer has not connected account services yet.");
  if (!client)
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  return client;
}
export function useSession() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      subscription;
    try {
      const c = authClient();
      c.auth
        .getSession()
        .then(({ data, error }) => {
          if (alive) {
            setSession(data.session);
            setLoading(false);
            if (error) setError(error.message);
          }
        })
        .catch((e) => {
          if (alive) {
            setError(e.message);
            setLoading(false);
          }
        });
      subscription = c.auth.onAuthStateChange((_event, s) => {
        if (alive) {
          setSession(s);
          setLoading(false);
        }
      }).data.subscription;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);
  return { session, loading, error };
}
export async function api(path, body) {
  const { data } = await authClient().auth.getSession();
  if (!data.session) throw Error("Please sign in to continue.");
  const options = {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  };
  if (body) {
    options.method = "POST";
    if (body instanceof FormData) options.body = body;
    else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }
  const response = await fetch(path, options);
  const json = await response.json();
  if (!response.ok)
    throw Error(json.error || "The request failed. Please retry.");
  return json;
}
export function dateTime(value) {
  return value
    ? new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Karachi",
      }).format(new Date(value)) + " PKT"
    : "To be announced";
}
