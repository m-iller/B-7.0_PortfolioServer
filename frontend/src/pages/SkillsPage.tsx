import { SkillGrid } from "../components/SkillGrid";
import { useApiGet } from "../hooks/useApiGet";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLang } from "../i18n";
import type { Skill } from "../types";

export function SkillsPage() {
  const { t } = useLang();
  const { data: skills, error, loading } = useApiGet<Skill[]>("/api/skills");
  useDocumentTitle("root@portfolio:~/skills");

  return (
    <section className="section">
      <h2>{t.skillsHead}</h2>
      <hr className="rule" />
      {error && <p className="error status">{error}</p>}
      {loading && !skills && <p className="muted">{t.loading}</p>}
      {skills && skills.length === 0 && <p className="muted">{t.emptySection}</p>}
      {skills && skills.length > 0 && <SkillGrid skills={skills} />}
    </section>
  );
}
