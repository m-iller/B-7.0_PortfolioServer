import { NavLink, Route, Routes } from "react-router-dom";
import { useLang } from "./i18n";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  const { lang, setLang, t } = useLang();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="prompt">root@portfolio:~$ ./resume.sh</div>
        <nav className="nav">
          <NavLink to="/" end>
            [ {t.home} ]
          </NavLink>
          <a href="/#personal">[ {t.personal} ]</a>
          <a href="/#projects">[ {t.projects} ]</a>
          <a href="/#skills">[ {t.skills} ]</a>
          <a href="/#experience">[ {t.experience} ]</a>
          <a href="/#education">[ {t.education} ]</a>
          <NavLink to="/admin">[ {t.admin} ]</NavLink>
          <span className="lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={`btn ${lang === "en" ? "btn-accent" : ""}`}
              onClick={() => setLang("en")}
            >
              [ EN ]
            </button>
            <button
              type="button"
              className={`btn ${lang === "ru" ? "btn-accent" : ""}`}
              onClick={() => setLang("ru")}
            >
              [ RU ]
            </button>
          </span>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}
