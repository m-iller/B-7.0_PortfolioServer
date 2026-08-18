import { useState } from "react";
import type { Project } from "../types";
import { Lightbox } from "./Lightbox";

export function ProjectCard({ project }: { project: Project }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

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
          {project.images.map((src, index) => (
            <button key={src} type="button" className="gallery-item" onClick={() => setLightbox(index)}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      {project.videos.map((src) => (
        <video key={src} className="local-video" controls preload="metadata" src={src} />
      ))}
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
