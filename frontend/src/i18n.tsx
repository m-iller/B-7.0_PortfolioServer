import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "ru";

const STORAGE_KEY = "portfolio_lang";

const copy = {
  en: {
    home: "home",
    personal: "personal",
    projects: "projects",
    skills: "skills",
    experience: "experience",
    education: "education",
    admin: "admin",
    personalHead: "$ cat ~/whoami.txt",
    projectsHead: "$ cat ~/projects/*.md",
    skillsHead: "$ find ~/skills -type f",
    experienceHead: "$ tail -f /var/log/experience.log",
    educationHead: "$ journalctl -u education",
    running: "Running process:",
    executing: "Executing script:",
  },
  ru: {
    home: "главная",
    personal: "обо мне",
    projects: "проекты",
    skills: "навыки",
    experience: "опыт",
    education: "образование",
    admin: "админ",
    personalHead: "$ cat ~/whoami.txt",
    projectsHead: "$ cat ~/projects/*.md",
    skillsHead: "$ find ~/skills -type f",
    experienceHead: "$ tail -f /var/log/experience.log",
    educationHead: "$ journalctl -u education",
    running: "Запуск процесса:",
    executing: "Выполнение скрипта:",
  },
} as const;

type UiCopy = (typeof copy)[Lang];

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: UiCopy;
}

const LangContext = createContext<LangContextValue | null>(null);

function readStoredLang(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "ru" || value === "en") return value;
  } catch {
    // ignore
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      t: copy[lang],
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used inside LanguageProvider");
  }
  return ctx;
}
