import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { configureSqlite, prisma } from "./db.js";
import { ensureAdmin } from "./services/adminService.js";
import { migrateEducationTranslations } from "./services/educationService.js";
import { migrateExperienceTranslations } from "./services/experienceService.js";
import { migrateProjectTranslations } from "./services/projectService.js";
import { ensureProfile } from "./services/profileService.js";
import { migrateSkillTranslations } from "./services/skillService.js";
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

const BOOTSTRAP_MARKER = path.join(config.dataDir, ".bootstrapped");

function markBootstrapped(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(BOOTSTRAP_MARKER)) {
    fs.writeFileSync(BOOTSTRAP_MARKER, `${new Date().toISOString()}\n`, "utf8");
  }
}

async function alreadyHasUserData(): Promise<boolean> {
  const [profile, folders, contacts, projects, skills, experience, education] = await Promise.all([
    prisma.profile.findUnique({ where: { id: "main" } }),
    prisma.projectFolder.count(),
    prisma.profileItem.count(),
    prisma.project.count(),
    prisma.skill.count(),
    prisma.experience.count(),
    prisma.education.count(),
  ]);
  const customName = Boolean(profile && profile.nameEn && profile.nameEn !== "Your Name");
  return customName || folders > 0 || contacts > 0 || projects > 0 || skills > 0 || experience > 0 || education > 0;
}

async function seed(): Promise<void> {
  await configureSqlite();
  await ensureAdmin();
  await ensureProfile();
  await migrateProjectTranslations();
  await migrateSkillTranslations();
  await migrateExperienceTranslations();
  await migrateEducationTranslations();

  if (fs.existsSync(BOOTSTRAP_MARKER) || (await alreadyHasUserData())) {
    markBootstrapped();
    console.log("[seed] skip dummy data — existing content is preserved");
    return;
  }

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
          titleEn: "Template Project Alpha",
          titleRu: "Шаблонный проект Альфа",
          description:
            "Seed project demonstrating the terminal card layout: title and tag-links on top, description in the body, a local image gallery, and an embedded YouTube player.",
          descriptionEn:
            "Seed project demonstrating the terminal card layout: title and tag-links on top, description in the body, a local image gallery, and an embedded YouTube player.",
          descriptionRu:
            "Демонстрационный проект: заголовок и теги-ссылки сверху, описание, галерея локальных фото и встроенный плеер YouTube.",
          images: toJson([alpha1, alpha2, alpha3]),
          videos: toJson([]),
          tagsLinks: toJson([
            { label: "GitHub", url: "https://github.com/" },
            { label: "Printables", url: "https://www.printables.com/" },
          ]),
          youtubeUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        },
        {
          title: "Template Project Beta",
          titleEn: "Template Project Beta",
          titleRu: "Шаблонный проект Бета",
          description:
            "Second seed project. Replace this record from /admin, the Telegram bot, or the CLI. Images live in the mounted /uploads volume.",
          descriptionEn:
            "Second seed project. Replace this record from /admin, the Telegram bot, or the CLI. Images live in the mounted /uploads volume.",
          descriptionRu:
            "Второй демонстрационный проект. Замените запись в /admin, через Telegram-бота или CLI. Файлы лежат в томе /uploads.",
          images: toJson([beta1, beta2]),
          videos: toJson([]),
          tagsLinks: toJson([{ label: "GitHub", url: "https://github.com/" }]),
          youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        },
        {
          title: "Template Project Gamma",
          titleEn: "Template Project Gamma",
          titleRu: "Шаблонный проект Гамма",
          description:
            "Third seed project without a YouTube embed so the gallery-only layout can be reviewed.",
          descriptionEn:
            "Third seed project without a YouTube embed so the gallery-only layout can be reviewed.",
          descriptionRu:
            "Третий демонстрационный проект без YouTube — только галерея фото.",
          images: toJson([gamma1, gamma2, gamma3]),
          videos: toJson([]),
          tagsLinks: toJson([
            { label: "Docs", url: "https://developer.mozilla.org/" },
            { label: "GitHub", url: "https://github.com/" },
          ]),
          youtubeUrl: "",
        },
      ],
    });
  }

  if ((await prisma.projectFolder.count()) === 0) {
    const folder = await prisma.projectFolder.create({
      data: {
        titleEn: "Hardware Lab",
        titleRu: "Железная лаборатория",
        sortOrder: 1,
      },
    });
    await prisma.project.updateMany({
      where: { titleEn: { in: ["Template Project Alpha", "Template Project Beta"] } },
      data: { folderId: folder.id },
    });
  }

  if ((await prisma.skill.count()) === 0) {
    await prisma.skill.createMany({
      data: [
        {
          title: "PTC Creo",
          titleEn: "PTC Creo",
          titleRu: "PTC Creo",
          category: "Mechanics",
          categoryEn: "Mechanics",
          categoryRu: "Механика",
          experienceYears: 2,
          proficiencyLevel: "Middle",
          proficiencyLevelEn: "Middle",
          proficiencyLevelRu: "Средний",
          description: "Solid modeling, assemblies, reverse engineering. Priority: parametric parts.",
          descriptionEn: "Solid modeling, assemblies, reverse engineering. Priority: parametric parts.",
          descriptionRu: "Твердотельное моделирование, сборки, реверс-инжиниринг. Приоритет: параметрические детали.",
        },
        {
          title: "FDM Printing",
          titleEn: "FDM Printing",
          titleRu: "FDM-печать",
          category: "Mechanics",
          categoryEn: "Mechanics",
          categoryRu: "Механика",
          experienceYears: 3,
          proficiencyLevel: "Senior",
          proficiencyLevelEn: "Senior",
          proficiencyLevelRu: "Старший",
          description: "FDM printing, priority PLA, also PETG and ABS. Slicer profiles and support strategy.",
          descriptionEn: "FDM printing, priority PLA, also PETG and ABS. Slicer profiles and support strategy.",
          descriptionRu: "FDM-печать, приоритет PLA, также PETG и ABS. Профили слайсера и стратегия поддержек.",
        },
        {
          title: "KiCad",
          titleEn: "KiCad",
          titleRu: "KiCad",
          category: "Electronics",
          categoryEn: "Electronics",
          categoryRu: "Электроника",
          experienceYears: 1.5,
          proficiencyLevel: "Junior",
          proficiencyLevelEn: "Junior",
          proficiencyLevelRu: "Младший",
          description: "Schematic capture, PCB layout, basic DRC. Through-hole and simple SMD boards.",
          descriptionEn: "Schematic capture, PCB layout, basic DRC. Through-hole and simple SMD boards.",
          descriptionRu: "Схемы, разводка плат, базовый DRC. Сквозной монтаж и простые SMD-платы.",
        },
        {
          title: "STM32",
          titleEn: "STM32",
          titleRu: "STM32",
          category: "Electronics",
          categoryEn: "Electronics",
          categoryRu: "Электроника",
          experienceYears: 2,
          proficiencyLevel: "Middle",
          proficiencyLevelEn: "Middle",
          proficiencyLevelRu: "Средний",
          description: "Bare-metal and HAL firmware, UART/SPI/I2C, timers, and basic RTOS tasks.",
          descriptionEn: "Bare-metal and HAL firmware, UART/SPI/I2C, timers, and basic RTOS tasks.",
          descriptionRu: "Прошивка bare-metal и HAL, UART/SPI/I2C, таймеры и базовые задачи RTOS.",
        },
        {
          title: "TypeScript",
          titleEn: "TypeScript",
          titleRu: "TypeScript",
          category: "Programming",
          categoryEn: "Programming",
          categoryRu: "Программирование",
          experienceYears: 4,
          proficiencyLevel: "Senior",
          proficiencyLevelEn: "Senior",
          proficiencyLevelRu: "Старший",
          description: "Node.js services, typed APIs, React frontends. Strict mode by default.",
          descriptionEn: "Node.js services, typed APIs, React frontends. Strict mode by default.",
          descriptionRu: "Сервисы Node.js, типизированные API, фронтенд на React. Strict mode по умолчанию.",
        },
        {
          title: "Python",
          titleEn: "Python",
          titleRu: "Python",
          category: "Programming",
          categoryEn: "Programming",
          categoryRu: "Программирование",
          experienceYears: 3,
          proficiencyLevel: "Middle",
          proficiencyLevelEn: "Middle",
          proficiencyLevelRu: "Средний",
          description: "Scripts, FastAPI prototypes, data munging, and hardware test harnesses.",
          descriptionEn: "Scripts, FastAPI prototypes, data munging, and hardware test harnesses.",
          descriptionRu: "Скрипты, прототипы FastAPI, обработка данных и стенды для железа.",
        },
      ],
    });
  }

  if ((await prisma.experience.count()) === 0) {
    await prisma.experience.createMany({
      data: [
        {
          companyOrProject: "Template Workshop",
          companyOrProjectEn: "Template Workshop",
          companyOrProjectRu: "Шаблонная мастерская",
          role: "Mechanical / Firmware Engineer",
          roleEn: "Mechanical / Firmware Engineer",
          roleRu: "Инженер механик / прошивок",
          description: "Placeholder role. Replace with real employment or project history.",
          descriptionEn: "Placeholder role. Replace with real employment or project history.",
          descriptionRu: "Заглушка. Замените на реальный опыт работы или проект.",
          period: "2022-2024",
        },
        {
          companyOrProject: "Open Hardware Lab",
          companyOrProjectEn: "Open Hardware Lab",
          companyOrProjectRu: "Лаборатория открытого железа",
          role: "Contributor",
          roleEn: "Contributor",
          roleRu: "Участник",
          description: "Dummy log entry for the terminal experience feed.",
          descriptionEn: "Dummy log entry for the terminal experience feed.",
          descriptionRu: "Демо-запись для ленты опыта в терминальном стиле.",
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
          institutionEn: "Template University",
          institutionRu: "Шаблонный университет",
          specialty: "Mechanical Engineering",
          specialtyEn: "Mechanical Engineering",
          specialtyRu: "Машиностроение",
          details: "Placeholder degree. Swap this record from the admin panel.",
          detailsEn: "Placeholder degree. Swap this record from the admin panel.",
          detailsRu: "Заглушка диплома. Замените запись в админ-панели.",
        },
        {
          institution: "Community Technical College",
          institutionEn: "Community Technical College",
          institutionRu: "Технический колледж",
          specialty: "Electronics",
          specialtyEn: "Electronics",
          specialtyRu: "Электроника",
          details: "Dummy coursework covering circuits, CAD, and embedded systems.",
          detailsEn: "Dummy coursework covering circuits, CAD, and embedded systems.",
          detailsRu: "Демо-курсы: схемы, CAD и встраиваемые системы.",
        },
      ],
    });
  }

  if ((await prisma.profileItem.count()) === 0) {
    await prisma.profileItem.createMany({
      data: [
        {
          labelEn: "GitHub",
          labelRu: "GitHub",
          value: "your-github",
          url: "https://github.com/",
          sortOrder: 1,
        },
        {
          labelEn: "Telegram",
          labelRu: "Telegram",
          value: "@your_nick",
          url: "https://t.me/",
          sortOrder: 2,
        },
        {
          labelEn: "Printables",
          labelRu: "Printables",
          value: "your-printables",
          url: "https://www.printables.com/",
          sortOrder: 3,
        },
        {
          labelEn: "Discord",
          labelRu: "Discord",
          value: "nickname#0000",
          url: "",
          sortOrder: 4,
        },
      ],
    });
  }

  markBootstrapped();
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
