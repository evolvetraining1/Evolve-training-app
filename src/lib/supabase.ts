import { AppState } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Configuration Supabase absente : vérifie EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env"
  );
}

let supabaseClient: ReturnType<typeof createClient>;

async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const response = await fetch(input, init);

  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  // Un jeton peut expirer entre la lecture de la session et une requête REST.
  // On ne retente qu'une seule fois, uniquement pour PostgREST, afin de ne pas
  // masquer une vraie erreur d'autorisation et d'éviter toute boucle de retry.
  if (response.status !== 401 || !url.includes("/rest/v1/")) {
    return response;
  }

  const { data, error } = await supabaseClient.auth.refreshSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    return response;
  }

  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

supabaseClient = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    global: {
      fetch: fetchWithAuthRetry,
    },
  }
);

export const supabase = supabaseClient;

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
