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
          <h3>{category}</h3>
          <div className="skill-list">
            {items.map((skill) => (
              <div className="skill" key={skill.id}>
                <div className="skill-head">
                  <strong>{skill.title}</strong>
                  <span className="skill-meta">
                    {skill.experienceYears}y · {skill.proficiencyLevel}
                  </span>
                </div>
                <p className="skill-desc">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
