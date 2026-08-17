import type { Project } from "../types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project">
      <h3>{project.title}</h3>
      <div className="tags">
        {project.tagsLinks.map((tag) => (
          <a key={`${tag.label}-${tag.url}`} className="tag" href={tag.url} target="_blank" rel="noreferrer noopener">
            [ &gt; {tag.label} ]
          </a>
        ))}
      </div>
      <p>{project.description}</p>
      {project.images.length > 0 && (
        <div className="gallery">
          {project.images.slice(0, 3).map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      )}
      {project.youtubeEmbed && (
        <div className="video">
          <iframe
            src={project.youtubeEmbed}
            title={`${project.title} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      )}
    </article>
  );
}
