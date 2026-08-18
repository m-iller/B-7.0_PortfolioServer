import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiSend, apiUpload, ensureCsrf } from "../api";
import type { Education, Experience, Project, Skill, TagLink } from "../types";

type Tab = "projects" | "skills" | "experience" | "education";

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
        {(["projects", "skills", "experience", "education"] as Tab[]).map((item) => (
          <button key={item} className={`btn ${tab === item ? "btn-accent" : ""}`} onClick={() => setTab(item)}>
            [ {item} ]
          </button>
        ))}
        <button className="btn" onClick={logout}>
          [ logout ]
        </button>
      </div>
      {status && <p className="status muted">{status}</p>}
      {tab === "projects" && <ProjectAdmin onStatus={setStatus} />}
      {tab === "skills" && <SkillAdmin onStatus={setStatus} />}
      {tab === "experience" && <ExperienceAdmin onStatus={setStatus} />}
      {tab === "education" && <EducationAdmin onStatus={setStatus} />}
    </section>
  );
}

function ProjectAdmin({ onStatus }: { onStatus: (value: string) => void }) {
  const empty = {
    title: "",
    description: "",
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
          title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          description
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
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
            <th>title</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      title: item.title,
                      description: item.description,
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
