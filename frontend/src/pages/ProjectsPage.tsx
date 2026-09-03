import { ProjectBrowser } from "../components/ProjectBrowser";
import { useApiGet } from "../hooks/useApiGet";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLang } from "../i18n";
import type { Project, ProjectFolder } from "../types";

export function ProjectsPage() {
  const { t } = useLang();
  const { data: projects, error: projectError, loading: projectsLoading } = useApiGet<Project[]>("/api/projects");
  const { data: folders, error: folderError, loading: foldersLoading } = useApiGet<ProjectFolder[]>("/api/folders");
  const error = projectError || folderError;
  useDocumentTitle("root@portfolio:~/projects");

  return (
    <section className="section">
      <h2>{t.projectsHead}</h2>
      <hr className="rule" />
      {error && <p className="error status">{error}</p>}
      {(projectsLoading || foldersLoading) && !projects && <p className="muted">{t.loading}</p>}
      {projects && folders && projects.length === 0 && folders.length === 0 && (
        <p className="muted">{t.emptySection}</p>
      )}
      {projects && folders && (projects.length > 0 || folders.length > 0) && (
        <ProjectBrowser projects={projects} folders={folders} />
      )}
    </section>
  );
}
