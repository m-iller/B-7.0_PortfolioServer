import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { configureSqlite, prisma } from "./db.js";
import { ensureAdmin } from "./services/adminService.js";
import { toJson } from "./utils/json.js";

function placeholderSvg(title: string, accent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#0b0b0b"/>
  <rect x="16" y="16" width="928" height="508" fill="none" stroke="${accent}" stroke-width="2"/>
  <text x="48" y="80" fill="${accent}" font-family="Courier New, monospace" font-size="22">root@portfolio:~$</text>
  <text x="48" y="130" fill="#d0d0d0" font-family="Courier New, monospace" font-size="36">${title}</text>
  <text x="48" y="190" fill="#8a8a8a" font-family="Courier New, monospace" font-size="16">dummy seed asset · local storage</text>
  <rect x="48" y="240" width="220" height="12" fill="${accent}" opacity="0.7"/>
  <rect x="48" y="268" width="140" height="12" fill="#333"/>
</svg>`;
}

function writePlaceholder(filename: string, title: string, accent: string): string {
  const absolute = path.join(config.uploadDir, filename);
  if (!fs.existsSync(absolute)) {
    fs.writeFileSync(absolute, placeholderSvg(title, accent), "utf8");
  }
  return `/uploads/${filename}`;
}

async function seed(): Promise<void> {
  await configureSqlite();
  await ensureAdmin();

  const projectCount = await prisma.project.count();
  if (projectCount === 0) {
    const alpha1 = writePlaceholder("seed-alpha-1.svg", "TEMPLATE PROJECT ALPHA", "#00ff66");
    const alpha2 = writePlaceholder("seed-alpha-2.svg", "ALPHA · GALLERY 02", "#00ff66");
    const alpha3 = writePlaceholder("seed-alpha-3.svg", "ALPHA · GALLERY 03", "#00ff66");
    const beta1 = writePlaceholder("seed-beta-1.svg", "TEMPLATE PROJECT BETA", "#ffbf00");
    const beta2 = writePlaceholder("seed-beta-2.svg", "BETA · GALLERY 02", "#ffbf00");
    const gamma1 = writePlaceholder("seed-gamma-1.svg", "TEMPLATE PROJECT GAMMA", "#7dffb3");
    const gamma2 = writePlaceholder("seed-gamma-2.svg", "GAMMA · GALLERY 02", "#7dffb3");
    const gamma3 = writePlaceholder("seed-gamma-3.svg", "GAMMA · GALLERY 03", "#7dffb3");

    await prisma.project.createMany({
      data: [
        {
          title: "Template Project Alpha",
          description:
            "Seed project demonstrating the terminal card layout: title and tag-links on top, description in the body, a local image gallery, and an embedded YouTube player.",
          images: toJson([alpha1, alpha2, alpha3]),
          tagsLinks: toJson([
            { label: "GitHub", url: "https://github.com/" },
            { label: "Printables", url: "https://www.printables.com/" },
          ]),
          youtubeUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        },
        {
          title: "Template Project Beta",
          description:
            "Second seed project. Replace this record from /admin, the Telegram bot, or the CLI. Images live in the mounted /uploads volume.",
          images: toJson([beta1, beta2]),
          tagsLinks: toJson([{ label: "GitHub", url: "https://github.com/" }]),
          youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        },
        {
          title: "Template Project Gamma",
          description:
            "Third seed project without a YouTube embed so the gallery-only layout can be reviewed.",
          images: toJson([gamma1, gamma2, gamma3]),
          tagsLinks: toJson([
            { label: "Docs", url: "https://developer.mozilla.org/" },
            { label: "GitHub", url: "https://github.com/" },
          ]),
          youtubeUrl: "",
        },
      ],
    });
  }

  if ((await prisma.skill.count()) === 0) {
    await prisma.skill.createMany({
      data: [
        {
          title: "PTC Creo",
          category: "Mechanics",
          experienceYears: 2,
          proficiencyLevel: "Middle",
          description: "Solid modeling, assemblies, reverse engineering. Priority: parametric parts.",
        },
        {
          title: "FDM Printing",
          category: "Mechanics",
          experienceYears: 3,
          proficiencyLevel: "Senior",
          description: "FDM printing, priority PLA, also PETG and ABS. Slicer profiles and support strategy.",
        },
        {
          title: "KiCad",
          category: "Electronics",
          experienceYears: 1.5,
          proficiencyLevel: "Junior",
          description: "Schematic capture, PCB layout, basic DRC. Through-hole and simple SMD boards.",
        },
        {
          title: "STM32",
          category: "Electronics",
          experienceYears: 2,
          proficiencyLevel: "Middle",
          description: "Bare-metal and HAL firmware, UART/SPI/I2C, timers, and basic RTOS tasks.",
        },
        {
          title: "TypeScript",
          category: "Programming",
          experienceYears: 4,
          proficiencyLevel: "Senior",
          description: "Node.js services, typed APIs, React frontends. Strict mode by default.",
        },
        {
          title: "Python",
          category: "Programming",
          experienceYears: 3,
          proficiencyLevel: "Middle",
          description: "Scripts, FastAPI prototypes, data munging, and hardware test harnesses.",
        },
      ],
    });
  }

  if ((await prisma.experience.count()) === 0) {
    await prisma.experience.createMany({
      data: [
        {
          companyOrProject: "Template Workshop",
          role: "Mechanical / Firmware Engineer",
          description: "Placeholder role. Replace with real employment or project history.",
          period: "2022-2024",
        },
        {
          companyOrProject: "Open Hardware Lab",
          role: "Contributor",
          description: "Dummy log entry for the terminal experience feed.",
          period: "2020-2022",
        },
      ],
    });
  }

  if ((await prisma.education.count()) === 0) {
    await prisma.education.createMany({
      data: [
        {
          institution: "Template University",
          specialty: "Mechanical Engineering",
          details: "Placeholder degree. Swap this record from the admin panel.",
        },
        {
          institution: "Community Technical College",
          specialty: "Electronics",
          details: "Dummy coursework covering circuits, CAD, and embedded systems.",
        },
      ],
    });
  }

  console.log("[seed] ready");
}

seed()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
