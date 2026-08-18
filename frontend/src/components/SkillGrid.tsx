import { useLang } from "../i18n";
import type { Skill } from "../types";

export function SkillGrid({ skills }: { skills: Skill[] }) {
  const { lang } = useLang();
  const groups = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    const category = lang === "ru" ? skill.categoryRu : skill.categoryEn;
    acc[category] = acc[category] ?? [];
    acc[category].push(skill);
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
                  <strong>{lang === "ru" ? skill.titleRu : skill.titleEn}</strong>
                  <span className="skill-meta">
                    {skill.experienceYears}y · {lang === "ru" ? skill.proficiencyLevelRu : skill.proficiencyLevelEn}
                  </span>
                </div>
                <p className="skill-desc">{lang === "ru" ? skill.descriptionRu : skill.descriptionEn}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
