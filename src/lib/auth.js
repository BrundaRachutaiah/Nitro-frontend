const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const LOCAL_TOKEN_KEY = "nitro_access_token";
const SESSION_TOKEN_KEY = "nitro_session_access_token";

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = [
      data?.message,
      data?.msg,
      data?.error_description,
      data?.error,
      data?.weak_password?.message
    ].filter(Boolean);

    const reason = details[0] || `Request failed (${response.status})`;
    const error = new Error(reason);
    error.status = response.status;

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfter = Number(retryAfterHeader);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfter = retryAfter;
    }

    throw error;
  }

  return data;
};

const hasAuthEnv = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && API_BASE_URL);
};

const getStoredToken = () => {
  return localStorage.getItem(LOCAL_TOKEN_KEY) || sessionStorage.getItem(SESSION_TOKEN_KEY);
};

const clearStoredTokens = () => {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
};

const storeToken = (token, rememberMe = true) => {
  clearStoredTokens();

  if (rememberMe) {
    localStorage.setItem(LOCAL_TOKEN_KEY, token);
    return;
  }

  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
};

const signInWithSupabase = async ({ email, password }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase frontend environment variables.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await parseResponse(response);

  if (!data?.access_token) {
    throw new Error("Supabase did not return an access token.");
  }

  return data.access_token;
};

const signUpWithSupabase = async ({ email, password, fullName }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase frontend environment variables.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      data: {
        full_name: fullName || ""
      }
    })
  });

  return parseResponse(response);
};

const resendSignupConfirmation = async (email) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase frontend environment variables.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`
      }
    })
  });

  return parseResponse(response);
};

const verifyBackendUser = async (token) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseResponse(response);

  if (!data?.user) {
    throw new Error("Backend did not return user details.");
  }

  return data.user;
};

const signOutFromSupabase = async (token) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !token) {
    return;
  }

  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  }).catch(() => {
    // Ignore network/logout errors and clear local session anyway.
  });
};

const getGoogleAuthorizeUrl = () => {
  if (!SUPABASE_URL) {
    throw new Error("Missing Supabase URL.");
  }

  const redirectTo = `${window.location.origin}/login`;
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirectTo,
    flow_type: "implicit"
  });

  return `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
};

const extractAccessTokenFromHash = () => {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  return params.get("access_token");
};

const clearOauthHash = () => {
  if (!window.location.hash) {
    return;
  }

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
};

export {
  API_BASE_URL,
  SUPABASE_ANON_KEY,
  clearOauthHash,
  clearStoredTokens,
  extractAccessTokenFromHash,
  getGoogleAuthorizeUrl,
  getStoredToken,
  hasAuthEnv,
  signInWithSupabase,
  signUpWithSupabase,
  resendSignupConfirmation,
  signOutFromSupabase,
  storeToken,
  verifyBackendUser
};
