import { useLang } from "../i18n";

export function LangSwitch({ variant }: { variant: "terminal" | "paper" }) {
  const { lang, setLang, t } = useLang();

  return (
    <div className={`lang-switch lang-switch-${variant}`} data-lang={lang}>
      {variant === "terminal" && (
        <span className="lang-switch-label" id="lang-switch-label">
          {t.langLabel}
        </span>
      )}
      <div className="lang-switch-track" role="group" aria-labelledby={variant === "terminal" ? "lang-switch-label" : undefined} aria-label={variant === "paper" ? t.langLabel : undefined}>
        <span className="lang-switch-thumb" aria-hidden="true" />
        <button
          type="button"
          className="lang-switch-opt"
          aria-pressed={lang === "en"}
          onClick={() => setLang("en")}
        >
          EN
        </button>
        <button
          type="button"
          className="lang-switch-opt"
          aria-pressed={lang === "ru"}
          onClick={() => setLang("ru")}
        >
          RU
        </button>
      </div>
    </div>
  );
}
