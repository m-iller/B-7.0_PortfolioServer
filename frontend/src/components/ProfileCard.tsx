import { useLang } from "../i18n";
import type { Profile } from "../types";

export function ProfileCard({ profile }: { profile: Profile }) {
  const { lang } = useLang();
  const name = lang === "ru" ? profile.nameRu : profile.nameEn;
  const about = lang === "ru" ? profile.aboutRu : profile.aboutEn;

  return (
    <article className="project profile-card">
      <h3>{name}</h3>
      {about && <p>{about}</p>}
      <div className="profile-list">
        {profile.items.map((item) => {
          const label = lang === "ru" ? item.labelRu : item.labelEn;
          return (
            <div className="profile-row" key={item.id}>
              <span className="profile-label">{label}</span>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer noopener">
                  {item.value}
                </a>
              ) : (
                <span>{item.value}</span>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
