import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { csrfProtection } from "../middleware/csrf.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  educationInputSchema,
  educationUpdateSchema,
  experienceInputSchema,
  experienceUpdateSchema,
  idParamSchema,
  profileInputSchema,
  profileItemInputSchema,
  profileItemUpdateSchema,
  projectInputSchema,
  projectUpdateSchema,
  skillInputSchema,
  skillUpdateSchema,
} from "../schemas/index.js";
import {
  createEducation,
  deleteEducation,
  listEducation,
  updateEducation,
} from "../services/educationService.js";
import {
  createExperience,
  deleteExperience,
  listExperience,
  updateExperience,
} from "../services/experienceService.js";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../services/projectService.js";
import {
  createSkill,
  deleteSkill,
  listSkills,
  updateSkill,
} from "../services/skillService.js";
import {
  createProfileItem,
  deleteProfileItem,
  getProfile,
  updateProfile,
  updateProfileItem,
} from "../services/profileService.js";
import { publicUploadPath, upload } from "../services/uploadService.js";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(csrfProtection);

adminRouter.get("/projects", async (_req, res, next) => {
  try {
    res.json(await listProjects());
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/projects", validateBody(projectInputSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createProject(req.body));
  } catch (error) {
    next(error);
  }
});

adminRouter.put(
  "/projects/:id",
  validateParams(idParamSchema),
  validateBody(projectUpdateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateProject(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.delete("/projects/:id", validateParams(idParamSchema), async (req, res, next) => {
  try {
    const ok = await deleteProject(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/skills", async (_req, res, next) => {
  try {
    res.json(await listSkills());
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/skills", validateBody(skillInputSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createSkill(req.body));
  } catch (error) {
    next(error);
  }
});

adminRouter.put(
  "/skills/:id",
  validateParams(idParamSchema),
  validateBody(skillUpdateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateSkill(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.delete("/skills/:id", validateParams(idParamSchema), async (req, res, next) => {
  try {
    const ok = await deleteSkill(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/experience", async (_req, res, next) => {
  try {
    res.json(await listExperience());
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/experience", validateBody(experienceInputSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createExperience(req.body));
  } catch (error) {
    next(error);
  }
});

adminRouter.put(
  "/experience/:id",
  validateParams(idParamSchema),
  validateBody(experienceUpdateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateExperience(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Experience not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.delete("/experience/:id", validateParams(idParamSchema), async (req, res, next) => {
  try {
    const ok = await deleteExperience(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Experience not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/education", async (_req, res, next) => {
  try {
    res.json(await listEducation());
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/education", validateBody(educationInputSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createEducation(req.body));
  } catch (error) {
    next(error);
  }
});

adminRouter.put(
  "/education/:id",
  validateParams(idParamSchema),
  validateBody(educationUpdateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateEducation(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Education not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.delete("/education/:id", validateParams(idParamSchema), async (req, res, next) => {
  try {
    const ok = await deleteEducation(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Education not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/profile", async (_req, res, next) => {
  try {
    res.json(await getProfile());
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/profile", validateBody(profileInputSchema), async (req, res, next) => {
  try {
    res.json(await updateProfile(req.body));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/profile/items", validateBody(profileItemInputSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createProfileItem(req.body));
  } catch (error) {
    next(error);
  }
});

adminRouter.put(
  "/profile/items/:id",
  validateParams(idParamSchema),
  validateBody(profileItemUpdateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateProfileItem(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Profile item not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.delete("/profile/items/:id", validateParams(idParamSchema), async (req, res, next) => {
  try {
    const ok = await deleteProfileItem(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Profile item not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/upload", upload.array("files", 12), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  res.status(201).json({
    paths: files.map((file) => publicUploadPath(file.filename)),
  });
});
