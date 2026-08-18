import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiSend, apiUpload, ensureCsrf } from "../api";
import type { Education, Experience, Profile, ProfileItem, Project, Skill, TagLink } from "../types";

type Tab = "profile" | "projects" | "skills" | "experience" | "education";

export function AdminPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("projects");
  const [status, setStatus] = useState("");

  useEffect(() => {
    ensureCsrf()
      .then(() => apiGet<{ authenticated: boolean }>("/api/auth/me"))
      .then(() => setReady(true))
      .catch(() => navigate("/login"));
  }, [navigate]);

  async function logout() {
    await apiSend("/api/auth/logout", "POST");
    navigate("/login");
  }

  if (!ready) {
    return <p className="muted status">authenticating...</p>;
  }

  return (
    <section className="section">
      <h2>$ sudo -i /admin</h2>
      <div className="row">
        {(["profile", "projects", "skills", "experience", "education"] as Tab[]).map((item) => (
          <button key={item} className={`btn ${tab === item ? "btn-accent" : ""}`} onClick={() => setTab(item)}>
            [ {item} ]
          </button>
        ))}
        <button className="btn" onClick={logout}>
          [ logout ]
        </button>
      </div>
      {status && <p className="status muted">{status}</p>}
      {tab === "profile" && <ProfileAdmin onStatus={setStatus} />}
      {tab === "projects" && <ProjectAdmin onStatus={setStatus} />}
      {tab === "skills" && <SkillAdmin onStatus={setStatus} />}
      {tab === "experience" && <ExperienceAdmin onStatus={setStatus} />}
      {tab === "education" && <EducationAdmin onStatus={setStatus} />}
    </section>
  );
}

function ProfileAdmin({ onStatus }: { onStatus: (value: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [header, setHeader] = useState({ nameEn: "", nameRu: "", aboutEn: "", aboutRu: "" });
  const emptyItem = { labelEn: "", labelRu: "", value: "", url: "", sortOrder: 0 };
  const [form, setForm] = useState(emptyItem);
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    const data = await apiGet<Profile>("/api/admin/profile");
    setProfile(data);
    setHeader({
      nameEn: data.nameEn,
      nameRu: data.nameRu,
      aboutEn: data.aboutEn,
      aboutRu: data.aboutRu,
    });
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus]);

  async function saveHeader(event: FormEvent) {
    event.preventDefault();
    await apiSend("/api/admin/profile", "PUT", header);
    onStatus("profile updated");
    await reload();
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/profile/items/${editing}`, "PUT", form);
      onStatus("contact updated");
    } else {
      await apiSend("/api/admin/profile/items", "POST", form);
      onStatus("contact created");
    }
    setForm(emptyItem);
    setEditing(null);
    await reload();
  }

  return (
    <>
      <form className="form" onSubmit={saveHeader}>
        <p className="muted">name and about (EN + RU)</p>
        <label>
          name EN
          <input value={header.nameEn} onChange={(e) => setHeader({ ...header, nameEn: e.target.value })} required />
        </label>
        <label>
          name RU
          <input value={header.nameRu} onChange={(e) => setHeader({ ...header, nameRu: e.target.value })} required />
        </label>
        <label>
          about EN
          <textarea value={header.aboutEn} onChange={(e) => setHeader({ ...header, aboutEn: e.target.value })} />
        </label>
        <label>
          about RU
          <textarea value={header.aboutRu} onChange={(e) => setHeader({ ...header, aboutRu: e.target.value })} />
        </label>
        <button className="btn btn-accent" type="submit">
          [ save profile ]
        </button>
      </form>

      <form className="form" onSubmit={saveItem}>
        <p className="muted">contact: link (url filled) or nickname only (url empty)</p>
        <label>
          label EN
          <input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} required />
        </label>
        <label>
          label RU
          <input value={form.labelRu} onChange={(e) => setForm({ ...form, labelRu: e.target.value })} required />
        </label>
        <label>
          value / nickname
          <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
        </label>
        <label>
          url (optional)
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://... or mailto: or leave empty"
          />
        </label>
        <label>
          sort
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
          />
        </label>
        <div className="row">
          <button className="btn btn-accent" type="submit">
            [ {editing ? "update" : "add"} contact ]
          </button>
          {editing && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null);
                setForm(emptyItem);
              }}
            >
              [ cancel ]
            </button>
          )}
        </div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>label</th>
            <th>value</th>
            <th>url</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(profile?.items ?? []).map((item: ProfileItem) => (
            <tr key={item.id}>
              <td>
                {item.labelEn} / {item.labelRu}
              </td>
              <td>{item.value}</td>
              <td>{item.url || "—"}</td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      labelEn: item.labelEn,
                      labelRu: item.labelRu,
                      value: item.value,
                      url: item.url,
                      sortOrder: item.sortOrder,
                    });
                  }}
                >
                  [ edit ]
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await apiSend(`/api/admin/profile/items/${item.id}`, "DELETE");
                    onStatus("contact deleted");
                    await reload();
                  }}
                >
                  [ delete ]
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ProjectAdmin({ onStatus }: { onStatus: (value: string) => void }) {
  const empty = {
    titleEn: "",
    titleRu: "",
    descriptionEn: "",
    descriptionRu: "",
    youtubeUrl: "",
    images: [] as string[],
    videos: [] as string[],
    tagsLinks: [] as TagLink[],
  };
  const [items, setItems] = useState<Project[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [tagLabel, setTagLabel] = useState("");
  const [tagUrl, setTagUrl] = useState("");

  async function reload() {
    setItems(await apiGet<Project[]>("/api/admin/projects"));
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus]);

  async function onUpload(files: FileList | null, kind: "images" | "videos") {
    if (!files?.length) return;
    const paths = await apiUpload(files);
    setForm((prev) => ({ ...prev, [kind]: [...prev[kind], ...paths] }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/projects/${editing}`, "PUT", form);
      onStatus("project updated");
    } else {
      await apiSend("/api/admin/projects", "POST", form);
      onStatus("project created");
    }
    setForm(empty);
    setEditing(null);
    await reload();
  }

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <label>
          title EN
          <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} required />
        </label>
        <label>
          title RU
          <input value={form.titleRu} onChange={(e) => setForm({ ...form, titleRu: e.target.value })} required />
        </label>
        <label>
          description EN
          <textarea
            value={form.descriptionEn}
            onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            required
          />
        </label>
        <label>
          description RU
          <textarea
            value={form.descriptionRu}
            onChange={(e) => setForm({ ...form, descriptionRu: e.target.value })}
            required
          />
        </label>
        <label>
          youtube_url
          <input value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} />
        </label>
        <label>
          images
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => onUpload(e.target.files, "images")}
          />
        </label>
        <p className="muted">{form.images.join(" ")}</p>
        <label>
          videos
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            multiple
            onChange={(e) => onUpload(e.target.files, "videos")}
          />
        </label>
        <p className="muted">{form.videos.join(" ")}</p>
        <div className="row">
          <input placeholder="tag label" value={tagLabel} onChange={(e) => setTagLabel(e.target.value)} />
          <input placeholder="https://..." value={tagUrl} onChange={(e) => setTagUrl(e.target.value)} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!tagLabel || !tagUrl) return;
              setForm({ ...form, tagsLinks: [...form.tagsLinks, { label: tagLabel, url: tagUrl }] });
              setTagLabel("");
              setTagUrl("");
            }}
          >
            [ add tag ]
          </button>
        </div>
        <p className="muted">{form.tagsLinks.map((tag) => tag.label).join(", ")}</p>
        <div className="row">
          <button className="btn btn-accent" type="submit">
            [ {editing ? "update" : "create"} project ]
          </button>
          {editing && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
            >
              [ cancel ]
            </button>
          )}
        </div>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>title EN / RU</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.titleEn} / {item.titleRu}
              </td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      titleEn: item.titleEn,
                      titleRu: item.titleRu,
                      descriptionEn: item.descriptionEn,
                      descriptionRu: item.descriptionRu,
                      youtubeUrl: item.youtubeUrl,
                      images: item.images,
                      videos: item.videos ?? [],
                      tagsLinks: item.tagsLinks,
                    });
                  }}
                >
                  [ edit ]
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await apiSend(`/api/admin/projects/${item.id}`, "DELETE");
                    onStatus("project deleted");
                    await reload();
                  }}
                >
                  [ delete ]
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function SkillAdmin({ onStatus }: { onStatus: (value: string) => void }) {
  const empty = {
    title: "",
    category: "Programming",
    experienceYears: 1,
    proficiencyLevel: "Middle",
    description: "",
  };
  const [items, setItems] = useState<Skill[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    setItems(await apiGet<Skill[]>("/api/admin/skills"));
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/skills/${editing}`, "PUT", form);
      onStatus("skill updated");
    } else {
      await apiSend("/api/admin/skills", "POST", form);
      onStatus("skill created");
    }
    setForm(empty);
    setEditing(null);
    await reload();
  }

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <label>
          title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          category
          <input
            list="skill-categories"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
          <datalist id="skill-categories">
            <option value="Mechanics" />
            <option value="Electronics" />
            <option value="Programming" />
          </datalist>
        </label>
        <label>
          experience_years
          <input
            type="number"
            min={0}
            step="0.1"
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
          />
        </label>
        <label>
          proficiency
          <input value={form.proficiencyLevel} onChange={(e) => setForm({ ...form, proficiencyLevel: e.target.value })} />
        </label>
        <label>
          description
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <button className="btn btn-accent" type="submit">
          [ {editing ? "update" : "create"} skill ]
        </button>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>title</th>
            <th>category</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.category}</td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      title: item.title,
                      category: item.category,
                      experienceYears: item.experienceYears,
                      proficiencyLevel: item.proficiencyLevel,
                      description: item.description,
                    });
                  }}
                >
                  [ edit ]
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await apiSend(`/api/admin/skills/${item.id}`, "DELETE");
                    onStatus("skill deleted");
                    await reload();
                  }}
                >
                  [ delete ]
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ExperienceAdmin({ onStatus }: { onStatus: (value: string) => void }) {
  const empty = { companyOrProject: "", role: "", period: "", description: "" };
  const [items, setItems] = useState<Experience[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    setItems(await apiGet<Experience[]>("/api/admin/experience"));
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/experience/${editing}`, "PUT", form);
    } else {
      await apiSend("/api/admin/experience", "POST", form);
    }
    onStatus(editing ? "experience updated" : "experience created");
    setForm(empty);
    setEditing(null);
    await reload();
  }

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <label>
          company_or_project
          <input value={form.companyOrProject} onChange={(e) => setForm({ ...form, companyOrProject: e.target.value })} required />
        </label>
        <label>
          role
          <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required />
        </label>
        <label>
          period
          <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
        </label>
        <label>
          description
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <button className="btn btn-accent" type="submit">
          [ {editing ? "update" : "create"} experience ]
        </button>
      </form>
      <table className="table">
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                [{item.period}] {item.role} @ {item.companyOrProject}
              </td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm(item);
                  }}
                >
                  [ edit ]
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await apiSend(`/api/admin/experience/${item.id}`, "DELETE");
                    await reload();
                  }}
                >
                  [ delete ]
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function EducationAdmin({ onStatus }: { onStatus: (value: string) => void }) {
  const empty = { institution: "", specialty: "", details: "" };
  const [items, setItems] = useState<Education[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    setItems(await apiGet<Education[]>("/api/admin/education"));
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/education/${editing}`, "PUT", form);
    } else {
      await apiSend("/api/admin/education", "POST", form);
    }
    onStatus(editing ? "education updated" : "education created");
    setForm(empty);
    setEditing(null);
    await reload();
  }

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <label>
          institution
          <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} required />
        </label>
        <label>
          specialty
          <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} required />
        </label>
        <label>
          details
          <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required />
        </label>
        <button className="btn btn-accent" type="submit">
          [ {editing ? "update" : "create"} education ]
        </button>
      </form>
      <table className="table">
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.institution} — {item.specialty}
              </td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm(item);
                  }}
                >
                  [ edit ]
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await apiSend(`/api/admin/education/${item.id}`, "DELETE");
                    await reload();
                  }}
                >
                  [ delete ]
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
