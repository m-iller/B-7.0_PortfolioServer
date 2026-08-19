import { Router } from "express";
import { listEducation } from "../services/educationService.js";
import { listExperience } from "../services/experienceService.js";
import { listFolders } from "../services/folderService.js";
import { getProject, listProjects } from "../services/projectService.js";
import { getProfile } from "../services/profileService.js";
import { listSkills } from "../services/skillService.js";

export const publicRouter = Router();

publicRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "portfolio-web" });
});

publicRouter.get("/profile", async (_req, res, next) => {
  try {
    res.json(await getProfile());
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/folders", async (_req, res, next) => {
  try {
    res.json(await listFolders());
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/projects", async (_req, res, next) => {
  try {
    res.json(await listProjects());
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/projects/:id", async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/skills", async (_req, res, next) => {
  try {
    res.json(await listSkills());
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/experience", async (_req, res, next) => {
  try {
    res.json(await listExperience());
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/education", async (_req, res, next) => {
  try {
    res.json(await listEducation());
  } catch (error) {
    next(error);
  }
});
