import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import { LangSwitch } from "./components/LangSwitch";
import { LegacyHashRedirect } from "./components/LegacyHashRedirect";
import { useLang } from "./i18n";
import { AdminPage } from "./pages/AdminPage";
import { CvPage } from "./pages/CvPage";
import { EducationPage } from "./pages/EducationPage";
import { ExperiencePage } from "./pages/ExperiencePage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SkillsPage } from "./pages/SkillsPage";

function TerminalLayout() {
  const { t } = useLang();

  return (
    <div className="shell">
      <LegacyHashRedirect />
      <header className="topbar">
        <div className="topbar-row">
          <div className="prompt">root@portfolio:~$ ./resume.sh</div>
          <nav className="nav">
            <NavLink to="/" end>
              [ {t.home} ]
            </NavLink>
            <NavLink to="/projects">[ {t.projects} ]</NavLink>
            <NavLink to="/skills">[ {t.skills} ]</NavLink>
            <NavLink to="/experience">[ {t.experience} ]</NavLink>
            <NavLink to="/education">[ {t.education} ]</NavLink>
            <NavLink to="/admin">[ {t.admin} ]</NavLink>
          </nav>
        </div>
        <div className="topbar-row topbar-tools">
          <LangSwitch variant="terminal" />
          <NavLink to="/cv" className="plain-launch">
            {t.plainOpen}
          </NavLink>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<TerminalLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/folder/:folderId" element={<ProjectsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/experience" element={<ExperiencePage />} />
        <Route path="/education" element={<EducationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/cv" element={<CvPage />} />
    </Routes>
  );
}
