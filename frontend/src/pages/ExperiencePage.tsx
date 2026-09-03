import { useApiGet } from "../hooks/useApiGet";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLang } from "../i18n";
import type { Experience } from "../types";

export function ExperiencePage() {
  const { lang, t } = useLang();
  const { data: experience, error, loading } = useApiGet<Experience[]>("/api/experience");
  useDocumentTitle("root@portfolio:~/experience");

  return (
    <section className="section">
      <h2>{t.experienceHead}</h2>
      <hr className="rule" />
      {error && <p className="error status">{error}</p>}
      {loading && !experience && <p className="muted">{t.loading}</p>}
      {experience && experience.length === 0 && <p className="muted">{t.emptySection}</p>}
      {experience && experience.length > 0 && (
        <div className="log">
          {experience.map((item) => (
            <p className="log-line" key={item.id}>
              <span className="ts">[{item.period}]</span>{" "}
              <span className="cmd">{t.running}</span> {lang === "ru" ? item.roleRu : item.roleEn} @{" "}
              {lang === "ru" ? item.companyOrProjectRu : item.companyOrProjectEn}
              {"\n"}
              <span className="muted">  # {lang === "ru" ? item.descriptionRu : item.descriptionEn}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
