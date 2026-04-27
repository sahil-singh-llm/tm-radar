import { useEffect, useState } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { Monitor } from './components/Monitor';

const API_KEY_STORAGE = 'anthropic_key';

type SessionConfig = {
  brand: string;
  apiKey: string;
  threshold: number;
  demoMode?: boolean;
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
    if (!cfg.demoMode && cfg.apiKey) {
      try {
        sessionStorage.setItem(API_KEY_STORAGE, cfg.apiKey);
      } catch {
        /* ignore */
      }
    }
    setConfig(cfg);
  };

  const handleStop = () => {
    setConfig(null);
  };

  if (!config) {
    return <SetupScreen initialKey={storedKey} onStart={handleStart} />;
  }

  return (
    <Monitor
      brand={config.brand}
      apiKey={config.apiKey}
      threshold={config.threshold}
      demoMode={!!config.demoMode}
      onStop={handleStop}
    />
  );
}
