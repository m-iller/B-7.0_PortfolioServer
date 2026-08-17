import { NavLink, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="prompt">root@portfolio:~$ ./resume.sh</div>
        <nav className="nav">
          <NavLink to="/" end>
            [ home ]
          </NavLink>
          <a href="/#projects">[ projects ]</a>
          <a href="/#skills">[ skills ]</a>
          <a href="/#experience">[ experience ]</a>
          <a href="/#education">[ education ]</a>
          <NavLink to="/admin">[ admin ]</NavLink>
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
