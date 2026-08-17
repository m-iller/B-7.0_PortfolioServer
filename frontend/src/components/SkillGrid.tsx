import type { Skill } from "../types";

export function SkillGrid({ skills }: { skills: Skill[] }) {
  const groups = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    acc[skill.category] = acc[skill.category] ?? [];
    acc[skill.category].push(skill);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([category, items]) => (
        <div className="skill-group" key={category}>
          <h3>$ ls skills/{category}/</h3>
          <div className="skill-grid">
            {items.map((skill) => (
              <div className="skill" key={skill.id} tabIndex={0}>
                <strong>{skill.title}</strong>
                <span className="hint">hover</span>
                <div className="tooltip">
                  +--------------------------------+
                  <br />
                  | {skill.title}
                  <br />
                  | years: {skill.experienceYears}
                  <br />
                  | level: {skill.proficiencyLevel}
                  <br />
                  | {skill.description}
                  <br />
                  +--------------------------------+
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
