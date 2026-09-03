import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLang } from "../i18n";
import type { Project, ProjectFolder } from "../types";
import { ProjectCard } from "./ProjectCard";

export function ProjectBrowser({
  projects,
  folders,
}: {
  projects: Project[];
  folders: ProjectFolder[];
}) {
  const { lang, t } = useLang();
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const openFolderId = folderId ?? null;

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === openFolderId) ?? null,
    [folders, openFolderId]
  );

  const folderProjects = useMemo(
    () => (activeFolder ? projects.filter((project) => project.folderId === activeFolder.id) : []),
    [activeFolder, projects]
  );

  const looseProjects = useMemo(
    () => projects.filter((project) => !project.folderId),
    [projects]
  );

  if (activeFolder) {
    const name = lang === "ru" ? activeFolder.titleRu : activeFolder.titleEn;
    return (
      <>
        <p className="muted folder-path">
          $ {t.folderOpen} ~/projects/{name}
        </p>
        <div className="row folder-toolbar">
          <button type="button" className="btn" onClick={() => navigate("/projects")}>
            {t.folderBack}
          </button>
        </div>
        {folderProjects.length === 0 ? (
          <p className="muted">{t.folderEmpty}</p>
        ) : (
          folderProjects.map((project) => <ProjectCard key={project.id} project={project} />)
        )}
      </>
    );
  }

  return (
    <>
      {folders.length > 0 && (
        <div className="folder-grid">
          {folders.map((folder) => {
            const name = lang === "ru" ? folder.titleRu : folder.titleEn;
            const count = projects.filter((project) => project.folderId === folder.id).length;
            return (
              <button
                key={folder.id}
                type="button"
                className="folder-card"
                onClick={() => navigate(`/projects/folder/${folder.id}`)}
              >
                <span className="folder-name">
                  [dir] {name}/
                </span>
                <span className="muted">
                  {count} {t.folderProjects}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {looseProjects.length > 0 && folders.length > 0 && (
        <p className="muted folder-loose">{t.looseProjects}</p>
      )}
      {looseProjects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </>
  );
}
