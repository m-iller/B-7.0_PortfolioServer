import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiSend, apiUpload, ensureCsrf } from "../api";
import type { Education, Experience, Profile, ProfileItem, Project, ProjectFolder, Skill, TagLink } from "../types";

type Tab = "profile" | "projects" | "skills" | "experience" | "education";

export function AdminPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("projects");
  const [status, setStatus] = useState("");
  const [projectTick, setProjectTick] = useState(0);

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
      {tab === "projects" && (
        <>
          <FolderAdmin onStatus={setStatus} tick={projectTick} onChange={() => setProjectTick((n) => n + 1)} />
          <ProjectAdmin onStatus={setStatus} tick={projectTick} onChange={() => setProjectTick((n) => n + 1)} />
        </>
      )}
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

function FolderAdmin({
  onStatus,
  tick,
  onChange,
}: {
  onStatus: (value: string) => void;
  tick: number;
  onChange: () => void;
}) {
  const empty = { titleEn: "", titleRu: "", sortOrder: 0 };
  const [items, setItems] = useState<ProjectFolder[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);

  async function reload() {
    setItems(await apiGet<ProjectFolder[]>("/api/admin/folders"));
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus, tick]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/folders/${editing}`, "PUT", form);
      onStatus("folder updated");
    } else {
      await apiSend("/api/admin/folders", "POST", form);
      onStatus("folder created");
    }
    setForm(empty);
    setEditing(null);
    onChange();
  }

  return (
    <>
      <p className="muted">folders (optional). deleting a folder leaves its projects ungrouped.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          folder title EN
          <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} required />
        </label>
        <label>
          folder title RU
          <input value={form.titleRu} onChange={(e) => setForm({ ...form, titleRu: e.target.value })} required />
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
            [ {editing ? "update" : "create"} folder ]
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
            <th>folder EN / RU</th>
            <th>projects</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.titleEn} / {item.titleRu}
              </td>
              <td>{item.projectCount}</td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      titleEn: item.titleEn,
                      titleRu: item.titleRu,
                      sortOrder: item.sortOrder,
                    });
                  }}
                >
                  [ edit ]
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await apiSend(`/api/admin/folders/${item.id}`, "DELETE");
                    onStatus("folder deleted");
                    onChange();
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

function ProjectAdmin({
  onStatus,
  tick,
  onChange,
}: {
  onStatus: (value: string) => void;
  tick: number;
  onChange: () => void;
}) {
  const empty = {
    titleEn: "",
    titleRu: "",
    descriptionEn: "",
    descriptionRu: "",
    youtubeUrl: "",
    images: [] as string[],
    videos: [] as string[],
    tagsLinks: [] as TagLink[],
    folderId: "" as string,
    sortOrder: 0,
  };
  const [items, setItems] = useState<Project[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [tagLabel, setTagLabel] = useState("");
  const [tagUrl, setTagUrl] = useState("");

  async function reload() {
    const [projects, nextFolders] = await Promise.all([
      apiGet<Project[]>("/api/admin/projects"),
      apiGet<ProjectFolder[]>("/api/admin/folders"),
    ]);
    setItems(projects);
    setFolders(nextFolders);
  }

  useEffect(() => {
    reload().catch((err: Error) => onStatus(err.message));
  }, [onStatus, tick]);

  async function onUpload(files: FileList | null, kind: "images" | "videos") {
    if (!files?.length) return;
    const paths = await apiUpload(files);
    setForm((prev) => ({ ...prev, [kind]: [...prev[kind], ...paths] }));
  }

  function payload() {
    return {
      ...form,
      folderId: form.folderId || null,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editing) {
      await apiSend(`/api/admin/projects/${editing}`, "PUT", payload());
      onStatus("project updated");
    } else {
      await apiSend("/api/admin/projects", "POST", payload());
      onStatus("project created");
    }
    setForm(empty);
    setEditing(null);
    onChange();
  }

  function folderLabel(folderId: string | null) {
    if (!folderId) return "—";
    const folder = folders.find((item) => item.id === folderId);
    return folder ? `${folder.titleEn} / ${folder.titleRu}` : folderId;
  }

  return (
    <>
      <p className="muted">projects: create and edit every section here (folder is optional).</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          folder (optional)
          <select value={form.folderId} onChange={(e) => setForm({ ...form, folderId: e.target.value })}>
            <option value="">no folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.titleEn} / {folder.titleRu}
              </option>
            ))}
          </select>
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
        {form.images.map((src) => (
          <div className="media-item" key={src}>
            <span className="muted">{src}</span>
            <button
              type="button"
              className="btn"
              onClick={() => setForm({ ...form, images: form.images.filter((item) => item !== src) })}
            >
              [ remove ]
            </button>
          </div>
        ))}
        <label>
          videos
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            multiple
            onChange={(e) => onUpload(e.target.files, "videos")}
          />
        </label>
        {form.videos.map((src) => (
          <div className="media-item" key={src}>
            <span className="muted">{src}</span>
            <button
              type="button"
              className="btn"
              onClick={() => setForm({ ...form, videos: form.videos.filter((item) => item !== src) })}
            >
              [ remove ]
            </button>
          </div>
        ))}
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
        {form.tagsLinks.map((tag, index) => (
          <div className="media-item" key={`${tag.label}-${tag.url}-${index}`}>
            <span className="muted">
              {tag.label} · {tag.url}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setForm({ ...form, tagsLinks: form.tagsLinks.filter((_, itemIndex) => itemIndex !== index) })
              }
            >
              [ remove ]
            </button>
          </div>
        ))}
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
            <th>folder</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.titleEn} / {item.titleRu}
              </td>
              <td>{folderLabel(item.folderId)}</td>
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
                      folderId: item.folderId ?? "",
                      sortOrder: item.sortOrder ?? 0,
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
                    onChange();
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
    titleEn: "",
    titleRu: "",
    categoryEn: "Programming",
    categoryRu: "Программирование",
    experienceYears: 1,
    proficiencyLevelEn: "Middle",
    proficiencyLevelRu: "Средний",
    descriptionEn: "",
    descriptionRu: "",
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
          title EN
          <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} required />
        </label>
        <label>
          title RU
          <input value={form.titleRu} onChange={(e) => setForm({ ...form, titleRu: e.target.value })} required />
        </label>
        <label>
          category EN
          <input
            list="skill-categories-en"
            value={form.categoryEn}
            onChange={(e) => setForm({ ...form, categoryEn: e.target.value })}
            required
          />
          <datalist id="skill-categories-en">
            <option value="Mechanics" />
            <option value="Electronics" />
            <option value="Programming" />
          </datalist>
        </label>
        <label>
          category RU
          <input
            list="skill-categories-ru"
            value={form.categoryRu}
            onChange={(e) => setForm({ ...form, categoryRu: e.target.value })}
            required
          />
          <datalist id="skill-categories-ru">
            <option value="Механика" />
            <option value="Электроника" />
            <option value="Программирование" />
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
          proficiency EN
          <input
            value={form.proficiencyLevelEn}
            onChange={(e) => setForm({ ...form, proficiencyLevelEn: e.target.value })}
            required
          />
        </label>
        <label>
          proficiency RU
          <input
            value={form.proficiencyLevelRu}
            onChange={(e) => setForm({ ...form, proficiencyLevelRu: e.target.value })}
            required
          />
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
        <button className="btn btn-accent" type="submit">
          [ {editing ? "update" : "create"} skill ]
        </button>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>title EN / RU</th>
            <th>category</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.titleEn} / {item.titleRu}
              </td>
              <td>
                {item.categoryEn} / {item.categoryRu}
              </td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      titleEn: item.titleEn,
                      titleRu: item.titleRu,
                      categoryEn: item.categoryEn,
                      categoryRu: item.categoryRu,
                      experienceYears: item.experienceYears,
                      proficiencyLevelEn: item.proficiencyLevelEn,
                      proficiencyLevelRu: item.proficiencyLevelRu,
                      descriptionEn: item.descriptionEn,
                      descriptionRu: item.descriptionRu,
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
  const empty = {
    companyOrProjectEn: "",
    companyOrProjectRu: "",
    roleEn: "",
    roleRu: "",
    period: "",
    descriptionEn: "",
    descriptionRu: "",
  };
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
          company_or_project EN
          <input
            value={form.companyOrProjectEn}
            onChange={(e) => setForm({ ...form, companyOrProjectEn: e.target.value })}
            required
          />
        </label>
        <label>
          company_or_project RU
          <input
            value={form.companyOrProjectRu}
            onChange={(e) => setForm({ ...form, companyOrProjectRu: e.target.value })}
            required
          />
        </label>
        <label>
          role EN
          <input value={form.roleEn} onChange={(e) => setForm({ ...form, roleEn: e.target.value })} required />
        </label>
        <label>
          role RU
          <input value={form.roleRu} onChange={(e) => setForm({ ...form, roleRu: e.target.value })} required />
        </label>
        <label>
          period
          <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
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
        <button className="btn btn-accent" type="submit">
          [ {editing ? "update" : "create"} experience ]
        </button>
      </form>
      <table className="table">
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                [{item.period}] {item.roleEn} / {item.roleRu} @ {item.companyOrProjectEn}
              </td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      companyOrProjectEn: item.companyOrProjectEn,
                      companyOrProjectRu: item.companyOrProjectRu,
                      roleEn: item.roleEn,
                      roleRu: item.roleRu,
                      period: item.period,
                      descriptionEn: item.descriptionEn,
                      descriptionRu: item.descriptionRu,
                    });
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
  const empty = {
    institutionEn: "",
    institutionRu: "",
    specialtyEn: "",
    specialtyRu: "",
    detailsEn: "",
    detailsRu: "",
  };
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
          institution EN
          <input value={form.institutionEn} onChange={(e) => setForm({ ...form, institutionEn: e.target.value })} required />
        </label>
        <label>
          institution RU
          <input value={form.institutionRu} onChange={(e) => setForm({ ...form, institutionRu: e.target.value })} required />
        </label>
        <label>
          specialty EN
          <input value={form.specialtyEn} onChange={(e) => setForm({ ...form, specialtyEn: e.target.value })} required />
        </label>
        <label>
          specialty RU
          <input value={form.specialtyRu} onChange={(e) => setForm({ ...form, specialtyRu: e.target.value })} required />
        </label>
        <label>
          details EN
          <textarea value={form.detailsEn} onChange={(e) => setForm({ ...form, detailsEn: e.target.value })} required />
        </label>
        <label>
          details RU
          <textarea value={form.detailsRu} onChange={(e) => setForm({ ...form, detailsRu: e.target.value })} required />
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
                {item.institutionEn} / {item.institutionRu} — {item.specialtyEn}
              </td>
              <td className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({
                      institutionEn: item.institutionEn,
                      institutionRu: item.institutionRu,
                      specialtyEn: item.specialtyEn,
                      specialtyRu: item.specialtyRu,
                      detailsEn: item.detailsEn,
                      detailsRu: item.detailsRu,
                    });
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
