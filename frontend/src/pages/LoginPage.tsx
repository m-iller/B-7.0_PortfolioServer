import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiSend, ensureCsrf, setCsrfToken } from "../api";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await ensureCsrf();
      const result = await apiSend<{ csrfToken: string }>("/api/auth/login", "POST", {
        username,
        password,
      });
      setCsrfToken(result.csrfToken);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <form className="form login-box" onSubmit={onSubmit}>
      <h2>$ sudo auth --admin</h2>
      <label>
        username
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-accent" type="submit">
        [ login ]
      </button>
    </form>
  );
}
