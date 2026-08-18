import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { configureSqlite, prisma } from "./db.js";
import {
  educationInputSchema,
  experienceInputSchema,
  profileInputSchema,
  profileItemInputSchema,
  projectInputSchema,
  skillInputSchema,
} from "./schemas/index.js";
import { createEducation } from "./services/educationService.js";
import { createExperience } from "./services/experienceService.js";
import { createProject, listProjects } from "./services/projectService.js";
import { createProfileItem, getProfile, updateProfile } from "./services/profileService.js";
import { createSkill, listSkills } from "./services/skillService.js";
import { publicUploadPath } from "./services/uploadService.js";
import { config } from "./config.js";

function arg(flag: string, fallback = ""): string {
  const index = process.argv.indexOf(flag);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function usage(): never {
  console.log(`Portfolio CLI

Usage:
  cli add-skill --name "PTC Creo" --category "Mechanics" --exp 2 --desc "Solid modeling" [--proficiency Middle]
  cli add-experience --company "Lab" --role "Engineer" --period "2020-2024" --desc "Work log"
  cli add-education --institution "University" --specialty "ME" --details "Degree notes"
  cli add-project
  cli set-profile --name-en "Name" --name-ru "Имя" --about-en "Bio" --about-ru "Био"
  cli add-contact --label-en GitHub --label-ru GitHub --value myuser --url https://github.com/myuser
  cli add-contact --label-en Discord --label-ru Discord --value nickname#0000
  cli list-projects
  cli list-skills
`);
  process.exit(1);
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function copyLocalFiles(raw: string, label: string): string[] {
  if (!raw) return [];
  const stored: string[] = [];
  for (const chunk of raw.split(",")) {
    const source = chunk.trim();
    if (!source) continue;
    const absolute = path.isAbsolute(source) ? source : path.resolve(source);
    if (!fs.existsSync(absolute)) {
      throw new Error(`${label} not found: ${absolute}`);
    }
    const filename = `${Date.now()}-${path.basename(absolute).replace(/[^A-Za-z0-9._-]/g, "")}`;
    const dest = path.join(config.uploadDir, filename);
    fs.copyFileSync(absolute, dest);
    stored.push(publicUploadPath(filename));
  }
  return stored;
}

async function addProjectInteractive(): Promise<void> {
  const titleEn = await prompt("Title EN: ");
  const titleRu = await prompt("Title RU: ");
  const descriptionEn = await prompt("Description EN: ");
  const descriptionRu = await prompt("Description RU: ");
  const youtubeUrl = await prompt("YouTube URL (blank to skip): ");
  const tagsRaw = await prompt("Tag links Label|url, Label|url (blank to skip): ");
  const imagesRaw = await prompt("Image paths (comma-separated host or container paths): ");
  const videosRaw = await prompt("Video paths mp4/webm (comma-separated, blank to skip): ");

  const images = copyLocalFiles(imagesRaw, "Image");
  const videos = copyLocalFiles(videosRaw, "Video");

  const tagsLinks = tagsRaw
    ? tagsRaw.split(",").map((chunk) => {
        const [label, url] = chunk.split("|").map((part) => part.trim());
        return { label, url };
      })
    : [];

  const created = await createProject(
    projectInputSchema.parse({
      titleEn,
      titleRu,
      descriptionEn,
      descriptionRu,
      youtubeUrl,
      images,
      videos,
      tagsLinks,
    })
  );
  console.log(`Created project ${created.id}`);
}

async function main(): Promise<void> {
  await configureSqlite();
  const command = process.argv[2];

  switch (command) {
    case "add-skill": {
      const created = await createSkill(
        skillInputSchema.parse({
          title: arg("--name"),
          category: arg("--category"),
          experienceYears: Number(arg("--exp", "0")),
          proficiencyLevel: arg("--proficiency", "Middle"),
          description: arg("--desc"),
        })
      );
      console.log(`Created skill ${created.id}`);
      break;
    }
    case "add-experience": {
      const created = await createExperience(
        experienceInputSchema.parse({
          companyOrProject: arg("--company"),
          role: arg("--role"),
          period: arg("--period"),
          description: arg("--desc"),
        })
      );
      console.log(`Created experience ${created.id}`);
      break;
    }
    case "add-education": {
      const created = await createEducation(
        educationInputSchema.parse({
          institution: arg("--institution"),
          specialty: arg("--specialty"),
          details: arg("--details"),
        })
      );
      console.log(`Created education ${created.id}`);
      break;
    }
    case "add-project":
      await addProjectInteractive();
      break;
    case "set-profile": {
      const current = await getProfile();
      const updated = await updateProfile(
        profileInputSchema.parse({
          nameEn: arg("--name-en", current.nameEn),
          nameRu: arg("--name-ru", current.nameRu),
          aboutEn: arg("--about-en", current.aboutEn),
          aboutRu: arg("--about-ru", current.aboutRu),
        })
      );
      console.log(`Updated profile ${updated.nameEn} / ${updated.nameRu}`);
      break;
    }
    case "add-contact": {
      const created = await createProfileItem(
        profileItemInputSchema.parse({
          labelEn: arg("--label-en"),
          labelRu: arg("--label-ru"),
          value: arg("--value"),
          url: arg("--url"),
          sortOrder: Number(arg("--sort", "0")),
        })
      );
      console.log(`Created contact ${created.id}`);
      break;
    }
    case "list-projects":
      for (const project of await listProjects()) {
        console.log(`${project.id}\t${project.titleEn} / ${project.titleRu}`);
      }
      break;
    case "list-skills":
      for (const skill of await listSkills()) {
        console.log(`${skill.id}\t[${skill.category}]\t${skill.title}`);
      }
      break;
    default:
      usage();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
