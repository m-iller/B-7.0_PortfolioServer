import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n";
import type { Project, ProjectFolder } from "../types";
import { ProjectCard } from "./ProjectCard";

const FOLDER_HASH = /^#projects\/folder\/([^/]+)$/;

function folderIdFromHash(): string | null {
  const match = window.location.hash.match(FOLDER_HASH);
  return match?.[1] ?? null;
}

export function ProjectBrowser({
  projects,
  folders,
}: {
  projects: Project[];
  folders: ProjectFolder[];
}) {
  const { lang, t } = useLang();
  const [openFolderId, setOpenFolderId] = useState<string | null>(folderIdFromHash);

  useEffect(() => {
    function syncFromHash() {
      setOpenFolderId(folderIdFromHash());
    }
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function enterFolder(id: string) {
    window.location.hash = `projects/folder/${id}`;
    setOpenFolderId(id);
  }

  function closeFolder() {
    window.location.hash = "projects";
    setOpenFolderId(null);
  }

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
          <button type="button" className="btn" onClick={closeFolder}>
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
                onClick={() => enterFolder(folder.id)}
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
