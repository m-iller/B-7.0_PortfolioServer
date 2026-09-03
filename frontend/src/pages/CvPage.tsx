import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";
import { LangSwitch } from "../components/LangSwitch";
import { Lightbox } from "../components/Lightbox";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLang } from "../i18n";
import type { Education, Experience, Profile, Project, ProjectFolder, Skill } from "../types";
import "../styles/cv.css";

const CONTRACT = `<!--
THESIS: Hiring manager reads one paper CV in daylight, not a terminal demo. Refuses command chrome, neon phosphor, and folder-as-navigation.
OWN-WORLD: Cool printer-paper field, black ink, Public Sans for reading, Literata for the name only. Hairline rules, no stacked cards, links as underlined ink.
STORY: Visitor knows who this is, what they built, where they worked, and how to return to the stylized portfolio.
FIRST VIEWPORT: Top row is return plus language switch. Name leads. Contact line under name. Bio, then experience, projects, skills, education.
FORM: Canon paper CV beside read.cv / Standard Resume. Code-led. Specified request, no direction roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

function BackArrow() {
  return (
    <svg className="cv-back-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10.5 3.5 L4.5 8 L10.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

function CvProject({ project, headingLevel = 3 }: { project: Project; headingLevel?: 3 | 4 }) {
  const { lang } = useLang();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const title = lang === "ru" ? project.titleRu : project.titleEn;
  const description = lang === "ru" ? project.descriptionRu : project.descriptionEn;
  const Heading = headingLevel === 4 ? "h4" : "h3";

  return (
    <article className="cv-project">
      <Heading>{title}</Heading>
      {project.tagsLinks.length > 0 && (
        <p className="cv-project-links">
          {project.tagsLinks.map((tag) => (
            <a key={`${tag.label}-${tag.url}`} href={tag.url} target="_blank" rel="noreferrer noopener">
              {tag.label}
            </a>
          ))}
        </p>
      )}
      {description && <p>{description}</p>}
      {project.images.length > 0 && (
        <div className="cv-gallery">
          {project.images.map((src, index) => (
            <button key={src} type="button" className="cv-gallery-item" onClick={() => setLightbox(index)}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      {project.videos.map((src) => (
        <video key={src} className="cv-video" controls preload="metadata" src={src} />
      ))}
      {project.youtubeEmbed && (
        <div className="cv-embed">
          <iframe
            src={`${project.youtubeEmbed}?rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`}
            title={`${title} video`}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
      {lightbox !== null && (
        <Lightbox
          images={project.images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </article>
  );
}

export function CvPage() {
  const { lang, t } = useLang();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    document.documentElement.classList.add("cv-mode");
    document.body.classList.add("cv-mode");
    return () => {
      document.documentElement.classList.remove("cv-mode");
      document.body.classList.remove("cv-mode");
    };
  }, []);

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

  const name = profile ? (lang === "ru" ? profile.nameRu : profile.nameEn) : "";
  const about = profile ? (lang === "ru" ? profile.aboutRu : profile.aboutEn) : "";
  useDocumentTitle(name || "Resume");

  const skillGroups = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, skill) => {
      const category = lang === "ru" ? skill.categoryRu : skill.categoryEn;
      acc[category] = acc[category] ?? [];
      acc[category].push(skill);
      return acc;
    }, {});
  }, [lang, skills]);

  const folderBlocks = useMemo(
    () =>
      folders
        .map((folder) => ({
          id: folder.id,
          title: lang === "ru" ? folder.titleRu : folder.titleEn,
          items: projects.filter((project) => project.folderId === folder.id),
        }))
        .filter((block) => block.items.length > 0),
    [folders, lang, projects]
  );
  const looseProjects = useMemo(
    () => projects.filter((project) => !project.folderId),
    [projects]
  );

  return (
    <div className="cv-root">
      <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
      <div className="cv-page">
        <div className="cv-toolbar">
          <Link to="/" className="cv-back">
            <BackArrow />
            {t.cvBack}
          </Link>
          <LangSwitch variant="paper" />
        </div>

        {error && <p className="cv-error">{error}</p>}

        <header className="cv-masthead">
          <h1>{name || "\u00a0"}</h1>
          {profile && profile.items.length > 0 && (
            <ul className="cv-contact">
              {profile.items.map((item) => {
                const label = lang === "ru" ? item.labelRu : item.labelEn;
                return (
                  <li key={item.id}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer noopener">
                        {item.value || label}
                      </a>
                    ) : (
                      <span>
                        {label}: {item.value}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {about && <p className="cv-about">{about}</p>}
        </header>

        <section className="cv-section">
          <h2>{t.cvExperience}</h2>
          {experience.length === 0 ? (
            <p className="cv-empty">{t.emptySection}</p>
          ) : (
            <ul className="cv-jobs">
              {experience.map((item) => (
                <li key={item.id}>
                  <div className="cv-job-head">
                    <h3>{lang === "ru" ? item.roleRu : item.roleEn}</h3>
                    <p className="cv-period">{item.period}</p>
                  </div>
                  <p className="cv-org">{lang === "ru" ? item.companyOrProjectRu : item.companyOrProjectEn}</p>
                  <p>{lang === "ru" ? item.descriptionRu : item.descriptionEn}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cv-section">
          <h2>{t.cvProjects}</h2>
          {projects.length === 0 ? (
            <p className="cv-empty">{t.emptySection}</p>
          ) : (
            <>
              {looseProjects.length > 0 && folderBlocks.length > 0 && (
                <h3 className="cv-folder-title">{t.cvOtherProjects}</h3>
              )}
              {looseProjects.map((project) => (
                <CvProject key={project.id} project={project} headingLevel={folderBlocks.length > 0 ? 4 : 3} />
              ))}
              {folderBlocks.map((block) => (
                <div className="cv-folder" key={block.id}>
                  <h3 className="cv-folder-title">{block.title}</h3>
                  {block.items.map((project) => (
                    <CvProject key={project.id} project={project} headingLevel={4} />
                  ))}
                </div>
              ))}
            </>
          )}
        </section>

        <section className="cv-section">
          <h2>{t.cvSkills}</h2>
          {skills.length === 0 ? (
            <p className="cv-empty">{t.emptySection}</p>
          ) : (
            Object.entries(skillGroups).map(([category, items]) => (
              <div className="cv-skill-group" key={category}>
                <h3>{category}</h3>
                <ul className="cv-skill-list">
                  {items.map((skill) => (
                    <li key={skill.id}>
                      <div className="cv-skill-head">
                        <strong>{lang === "ru" ? skill.titleRu : skill.titleEn}</strong>
                        <span>
                          {skill.experienceYears}
                          {t.yearsUnit} · {lang === "ru" ? skill.proficiencyLevelRu : skill.proficiencyLevelEn}
                        </span>
                      </div>
                      <p>{lang === "ru" ? skill.descriptionRu : skill.descriptionEn}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="cv-section">
          <h2>{t.cvEducation}</h2>
          {education.length === 0 ? (
            <p className="cv-empty">{t.emptySection}</p>
          ) : (
            <ul className="cv-jobs">
              {education.map((item) => (
                <li key={item.id}>
                  <div className="cv-job-head">
                    <h3>{lang === "ru" ? item.specialtyRu : item.specialtyEn}</h3>
                  </div>
                  <p className="cv-org">{lang === "ru" ? item.institutionRu : item.institutionEn}</p>
                  <p>{lang === "ru" ? item.detailsRu : item.detailsEn}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
