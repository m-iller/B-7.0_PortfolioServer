import { useEffect, useState } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { SkillGrid } from "../components/SkillGrid";
import { apiGet } from "../api";
import type { Education, Experience, Project, Skill } from "../types";

export function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<Project[]>("/api/projects"),
      apiGet<Skill[]>("/api/skills"),
      apiGet<Experience[]>("/api/experience"),
      apiGet<Education[]>("/api/education"),
    ])
      .then(([p, s, e, d]) => {
        setProjects(p);
        setSkills(s);
        setExperience(e);
        setEducation(d);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      {error && <p className="error status">{error}</p>}

      <section className="section" id="projects">
        <h2>$ cat ~/projects/*.md</h2>
        <hr className="rule" />
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>

      <section className="section" id="skills">
        <h2>$ find ~/skills -type f</h2>
        <hr className="rule" />
        <SkillGrid skills={skills} />
      </section>

      <section className="section" id="experience">
        <h2>$ tail -f /var/log/experience.log</h2>
        <hr className="rule" />
        <div className="log">
          {experience.map((item) => (
            <p className="log-line" key={item.id}>
              <span className="ts">[{item.period}]</span>{" "}
              <span className="cmd">Running process:</span> {item.role} @ {item.companyOrProject}
              {"\n"}
              <span className="muted">  # {item.description}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="section" id="education">
        <h2>$ journalctl -u education</h2>
        <hr className="rule" />
        <div className="log">
          {education.map((item) => (
            <p className="log-line" key={item.id}>
              <span className="ts">[{item.institution}]</span>{" "}
              <span className="cmd">Executing script:</span> {item.specialty}
              {"\n"}
              <span className="muted">  # {item.details}</span>
            </p>
          ))}
        </div>
      </section>
    </>
  );
}
