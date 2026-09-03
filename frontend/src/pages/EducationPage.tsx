import { useApiGet } from "../hooks/useApiGet";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLang } from "../i18n";
import type { Education } from "../types";

export function EducationPage() {
  const { lang, t } = useLang();
  const { data: education, error, loading } = useApiGet<Education[]>("/api/education");
  useDocumentTitle("root@portfolio:~/education");

  return (
    <section className="section">
      <h2>{t.educationHead}</h2>
      <hr className="rule" />
      {error && <p className="error status">{error}</p>}
      {loading && !education && <p className="muted">{t.loading}</p>}
      {education && education.length === 0 && <p className="muted">{t.emptySection}</p>}
      {education && education.length > 0 && (
        <div className="log">
          {education.map((item) => (
            <p className="log-line" key={item.id}>
              <span className="ts">[{lang === "ru" ? item.institutionRu : item.institutionEn}]</span>{" "}
              <span className="cmd">{t.executing}</span> {lang === "ru" ? item.specialtyRu : item.specialtyEn}
              {"\n"}
              <span className="muted">  # {lang === "ru" ? item.detailsRu : item.detailsEn}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
