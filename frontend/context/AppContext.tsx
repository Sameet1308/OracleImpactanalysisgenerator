import React, { createContext, useContext, useState } from 'react';

type AppState = {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
};

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoMode, setDemoMode] = useState(true);
  return <AppContext.Provider value={{ demoMode, setDemoMode }}>{children}</AppContext.Provider>;
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
