import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { configureSqlite, prisma } from "./db.js";
import {
  educationInputSchema,
  experienceInputSchema,
  projectInputSchema,
  skillInputSchema,
} from "./schemas/index.js";
import { createEducation } from "./services/educationService.js";
import { createExperience } from "./services/experienceService.js";
import { createProject, listProjects } from "./services/projectService.js";
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

async function addProjectInteractive(): Promise<void> {
  const title = await prompt("Title: ");
  const description = await prompt("Description: ");
  const youtubeUrl = await prompt("YouTube URL (blank to skip): ");
  const tagsRaw = await prompt("Tag links Label|url, Label|url (blank to skip): ");
  const imagesRaw = await prompt("Image paths (comma-separated host or container paths): ");

  const images: string[] = [];
  if (imagesRaw) {
    for (const raw of imagesRaw.split(",")) {
      const source = raw.trim();
      if (!source) continue;
      const absolute = path.isAbsolute(source) ? source : path.resolve(source);
      if (!fs.existsSync(absolute)) {
        throw new Error(`Image not found: ${absolute}`);
      }
      const filename = `${Date.now()}-${path.basename(absolute).replace(/[^A-Za-z0-9._-]/g, "")}`;
      const dest = path.join(config.uploadDir, filename);
      fs.copyFileSync(absolute, dest);
      images.push(publicUploadPath(filename));
    }
  }

  const tagsLinks = tagsRaw
    ? tagsRaw.split(",").map((chunk) => {
        const [label, url] = chunk.split("|").map((part) => part.trim());
        return { label, url };
      })
    : [];

  const created = await createProject(
    projectInputSchema.parse({ title, description, youtubeUrl, images, tagsLinks })
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
    case "list-projects":
      for (const project of await listProjects()) {
        console.log(`${project.id}\t${project.title}`);
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
