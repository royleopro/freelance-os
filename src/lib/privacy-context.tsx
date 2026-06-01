"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface PrivacyContextValue {
  isHidden: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isHidden: false,
  toggle: () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("privacy-mode");
    if (stored === "true") setIsHidden(true);
  }, []);

  function toggle() {
    setIsHidden((prev) => {
      const next = !prev;
      localStorage.setItem("privacy-mode", String(next));
      return next;
    });
  }

  return (
    <PrivacyContext.Provider value={{ isHidden, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyContext);
}
