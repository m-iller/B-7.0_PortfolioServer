import { NavLink } from "react-router-dom";
import { ProfileCard } from "../components/ProfileCard";
import { useApiGet } from "../hooks/useApiGet";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLang } from "../i18n";
import type { Profile } from "../types";

export function HomePage() {
  const { t } = useLang();
  const { data: profile, error, loading } = useApiGet<Profile>("/api/profile");
  useDocumentTitle("root@portfolio:~");

  const pages = [
    { to: "/projects", name: t.projects, hint: t.linkProjects },
    { to: "/skills", name: t.skills, hint: t.linkSkills },
    { to: "/experience", name: t.experience, hint: t.linkExperience },
    { to: "/education", name: t.education, hint: t.linkEducation },
  ];

  return (
    <>
      {error && <p className="error status">{error}</p>}

      <section className="section" id="personal">
        <h2>{t.personalHead}</h2>
        <hr className="rule" />
        {loading && !profile && <p className="muted">{t.loading}</p>}
        {profile && <ProfileCard profile={profile} />}
      </section>

      <section className="section">
        <h2>{t.lsPages}</h2>
        <hr className="rule" />
        <nav className="dir-list" aria-label={t.home}>
          {pages.map((page) => (
            <NavLink key={page.to} to={page.to} className="dir-link">
              <span className="dir-name">[dir] {page.name}/</span>
              <span className="muted">{page.hint}</span>
            </NavLink>
          ))}
        </nav>
      </section>
    </>
  );
}
