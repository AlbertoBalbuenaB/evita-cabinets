import { useEffect, useCallback } from 'react';

// Minimal ambient types — @types/google.picker and @types/gapi are not installed.
declare global {
  interface Window {
    gapi?: {
      load: (module: string, callback: () => void) => void;
    };
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => { requestAccessToken: (overrides?: { prompt?: string }) => void };
        };
      };
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS: string };
        Action: { PICKED: string; CANCEL: string };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView: (viewId: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (appId: string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setCallback: (cb: (data: PickerCallbackData) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface PickerDoc {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  iconUrl?: string;
}

interface PickerCallbackData {
  action: string;
  docs?: PickerDoc[];
}

export interface PickedFile {
  name: string;
  url: string;
  mimeType: string;
  iconUrl?: string;
}

// Module-level singletons: each resource loads exactly once process-wide.
let gapiScriptPromise: Promise<void> | null = null;
let gsiScriptPromise: Promise<void> | null = null;
let pickerModulePromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function ensureGapiScript(): Promise<void> {
  if (!gapiScriptPromise) {
    gapiScriptPromise = loadScript('https://apis.google.com/js/api.js');
  }
  return gapiScriptPromise;
}

function ensureGsiScript(): Promise<void> {
  if (!gsiScriptPromise) {
    gsiScriptPromise = loadScript('https://accounts.google.com/gsi/client');
  }
  return gsiScriptPromise;
}

function ensurePickerModule(): Promise<void> {
  if (!pickerModulePromise) {
    pickerModulePromise = ensureGapiScript().then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (!window.gapi) {
            reject(new Error('gapi not available after load'));
            return;
          }
          window.gapi.load('picker', () => resolve());
        })
    );
  }
  return pickerModulePromise;
}

async function ensureAllReady(): Promise<void> {
  await Promise.all([ensurePickerModule(), ensureGsiScript()]);
}

export function useGooglePicker() {
  // Preload scripts so the first click is instant.
  useEffect(() => {
    ensureAllReady().catch((err) => {
      console.error('Google Picker preload failed:', err);
    });
  }, []);

  const openPicker = useCallback(
    async (callback: (file: PickedFile) => void): Promise<void> => {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
      const appId = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

      if (!apiKey || !appId || !clientId) {
        console.error(
          'Google Picker: missing env vars (VITE_GOOGLE_API_KEY / VITE_GOOGLE_APP_ID / VITE_GOOGLE_CLIENT_ID)'
        );
        return;
      }

      try {
        await ensureAllReady();
      } catch (err) {
        console.error('Google Picker: script load failed', err);
        return;
      }

      if (!window.google?.accounts?.oauth2 || !window.google?.picker) {
        console.error('Google Picker: google namespace unavailable');
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response) => {
          if (response.error || !response.access_token) {
            console.error('Google Picker: token error', response.error);
            return; // cancel or error: no-op
          }
          createPicker(response.access_token, apiKey, appId, callback);
        },
        error_callback: (err) => {
          // User closed the consent popup, etc. No-op.
          console.warn('Google Picker: oauth error_callback', err);
        },
      });

      tokenClient.requestAccessToken({ prompt: '' });
    },
    []
  );

  return { openPicker };
}

function createPicker(
  accessToken: string,
  apiKey: string,
  appId: string,
  callback: (file: PickedFile) => void
) {
  const g = window.google!;
  const picker = new g.picker.PickerBuilder()
    .addView(g.picker.ViewId.DOCS)
    .setDeveloperKey(apiKey)
    .setAppId(appId)
    .setOAuthToken(accessToken)
    .setCallback((data) => {
      if (data.action === g.picker.Action.PICKED) {
        const doc = data.docs?.[0];
        if (doc) {
          callback({
            name: doc.name,
            url: doc.url,
            mimeType: doc.mimeType,
            iconUrl: doc.iconUrl,
          });
        }
      }
      // CANCEL or any other action: no-op.
    })
    .build();

  picker.setVisible(true);
}
