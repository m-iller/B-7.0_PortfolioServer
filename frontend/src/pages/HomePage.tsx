import { useEffect, useState } from "react";
import { ProfileCard } from "../components/ProfileCard";
import { ProjectBrowser } from "../components/ProjectBrowser";
import { SkillGrid } from "../components/SkillGrid";
import { apiGet } from "../api";
import { useLang } from "../i18n";
import type { Education, Experience, Profile, Project, ProjectFolder, Skill } from "../types";

export function HomePage() {
  const { lang, t } = useLang();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<Profile>("/api/profile"),
      apiGet<Project[]>("/api/projects"),
      apiGet<ProjectFolder[]>("/api/folders"),
      apiGet<Skill[]>("/api/skills"),
      apiGet<Experience[]>("/api/experience"),
      apiGet<Education[]>("/api/education"),
    ])
      .then(([info, p, f, s, e, d]) => {
        setProfile(info);
        setProjects(p);
        setFolders(f);
        setSkills(s);
        setExperience(e);
        setEducation(d);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      {error && <p className="error status">{error}</p>}

      <section className="section" id="personal">
        <h2>{t.personalHead}</h2>
        <hr className="rule" />
        {profile && <ProfileCard profile={profile} />}
      </section>

      <section className="section" id="projects">
        <h2>{t.projectsHead}</h2>
        <hr className="rule" />
        <ProjectBrowser projects={projects} folders={folders} />
      </section>

      <section className="section" id="skills">
        <h2>{t.skillsHead}</h2>
        <hr className="rule" />
        <SkillGrid skills={skills} />
      </section>

      <section className="section" id="experience">
        <h2>{t.experienceHead}</h2>
        <hr className="rule" />
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
      </section>

      <section className="section" id="education">
        <h2>{t.educationHead}</h2>
        <hr className="rule" />
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
      </section>
    </>
  );
}
