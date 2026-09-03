import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const HASH_ROUTES: Record<string, string> = {
  "#personal": "/",
  "#projects": "/projects",
  "#skills": "/skills",
  "#experience": "/experience",
  "#education": "/education",
};

export function LegacyHashRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const folder = hash.match(/^#projects\/folder\/([^/]+)$/);
    if (folder) {
      navigate(`/projects/folder/${folder[1]}`, { replace: true });
      return;
    }
    const dest = HASH_ROUTES[hash];
    if (dest) navigate(dest, { replace: true });
  }, [navigate]);

  return null;
}
