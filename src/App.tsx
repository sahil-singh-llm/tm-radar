import { useEffect, useState } from 'react';
import { SetupScreen, type SessionMode } from './components/SetupScreen';
import { Monitor } from './components/Monitor';
import { workerEnabled } from './lib/claude';

const API_KEY_STORAGE = 'anthropic_key';

type SessionConfig = {
  brand: string;
  mode: SessionMode;
  apiKey?: string;
  threshold: number;
};

export default function App() {
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [storedKey, setStoredKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const k = sessionStorage.getItem(API_KEY_STORAGE);
      if (k) setStoredKey(k);
    } catch {
      /* sessionStorage unavailable — proceed without */
    }
  }, []);

  const handleStart = (cfg: SessionConfig) => {
    if (cfg.mode === 'byok' && cfg.apiKey) {
      try {
        sessionStorage.setItem(API_KEY_STORAGE, cfg.apiKey);
      } catch {
        /* ignore */
      }
    }
    setConfig(cfg);
  };

  if (!config) {
    return (
      <SetupScreen
        initialKey={storedKey}
        workerEnabled={workerEnabled}
        onStart={handleStart}
      />
    );
  }

  return (
    <Monitor
      brand={config.brand}
      mode={config.mode}
      apiKey={config.apiKey ?? ''}
      threshold={config.threshold}
      onStop={() => setConfig(null)}
    />
  );
}
