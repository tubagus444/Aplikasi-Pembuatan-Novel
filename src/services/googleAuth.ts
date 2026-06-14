import { initializeApp } from 'firebase/app';
// Keeping this clean without firebase dependencies

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

let cachedAccessToken: string | null = null;
let cachedUser: GoogleUser | null = null;
let tokenExpiresAt: number | null = null;

const loadGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load GIS script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GIS script'));
    document.head.appendChild(script);
  });
};

export const initAuth = async (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (cachedAccessToken && cachedUser) {
    if (onAuthSuccess) onAuthSuccess(cachedUser, cachedAccessToken);
  } else {
    if (onAuthFailure) onAuthFailure();
  }
};

export const googleSignIn = async (clientId: string): Promise<{ user: GoogleUser; accessToken: string } | null> => {
  if (!clientId || clientId.trim() === '') {
    alert("Silakan masukkan Google Client ID di Pengaturan terlebih dahulu.");
    return null;
  }

  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (response: any) => {
          if (response.error !== undefined) {
             console.error("GIS Error:", response);
             reject(response);
          }
          if (response.access_token) {
             cachedAccessToken = response.access_token;
             // Set expiration to 5 mins before actual expiry to be safe
             const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3600;
             tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000;
             // Fetch user info
             try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${cachedAccessToken}` }
                });
                if (userInfoRes.ok) {
                   const data = await userInfoRes.json();
                   cachedUser = {
                     name: data.name,
                     email: data.email,
                     picture: data.picture
                   };
                   resolve({ user: cachedUser, accessToken: cachedAccessToken });
                } else {
                   cachedUser = { name: 'Unknown', email: 'Connected', picture: '' };
                   resolve({ user: cachedUser, accessToken: cachedAccessToken });
                }
             } catch (e) {
                console.error("Failed to fetch user info", e);
                cachedUser = { name: 'Unknown', email: 'Connected', picture: '' };
                resolve({ user: cachedUser, accessToken: cachedAccessToken });
             }
          }
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Sign in error:', err);
      reject(err);
    }
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && tokenExpiresAt && Date.now() > tokenExpiresAt) {
    cachedAccessToken = null;
    cachedUser = null;
    tokenExpiresAt = null;
    throw new Error("TOKEN_EXPIRED");
  }
  return cachedAccessToken;
};

export const logout = async () => {
  if (cachedAccessToken) {
    try {
      if ((window as any).google?.accounts?.oauth2) {
         (window as any).google.accounts.oauth2.revoke(cachedAccessToken, () => {
             console.log("Access token revoked");
         });
      }
    } catch (e) {}
  }
  cachedAccessToken = null;
  cachedUser = null;
  tokenExpiresAt = null;
};
