import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Appearance = "light" | "dark" | "device";
const Context = createContext<{ appearance: Appearance; setAppearance: (value: Appearance) => void } | null>(null);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setValue] = useState<Appearance>("device");
  useEffect(() => {
    const saved = localStorage.getItem("rooted:appearance");
    if (saved === "light" || saved === "dark" || saved === "device") setValue(saved);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = appearance === "device" ? (media.matches ? "dark" : "light") : appearance;
      document.documentElement.dataset['theme'] = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
    };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  const setAppearance = (value: Appearance) => { localStorage.setItem("rooted:appearance", value); setValue(value); };
  return <Context.Provider value={{ appearance, setAppearance }}>{children}</Context.Provider>;
}
export function useAppearance() {
  const value = useContext(Context);
  if (!value) throw new Error("Appearance provider missing");
  return value;
}