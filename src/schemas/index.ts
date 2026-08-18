import { z } from "zod";
import { sanitizeText, sanitizeProfileUrl, sanitizeUrl, toYoutubeEmbedUrl } from "../utils/sanitize.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => sanitizeText(value));

const nonEmpty = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => sanitizeText(value));

export const tagLinkSchema = z.object({
  label: nonEmpty(64),
  url: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .transform((value) => sanitizeUrl(value)),
});

export const projectInputSchema = z.object({
  titleEn: nonEmpty(160),
  titleRu: nonEmpty(160),
  descriptionEn: nonEmpty(8000),
  descriptionRu: nonEmpty(8000),
  images: z.array(z.string().min(1).max(512)).max(8).default([]),
  videos: z.array(z.string().min(1).max(512)).max(8).default([]),
  tagsLinks: z.array(tagLinkSchema).max(12).default([]),
  youtubeUrl: z
    .string()
    .trim()
    .max(512)
    .optional()
    .default("")
    .transform((value) => (value ? toYoutubeEmbedUrl(value) : "")),
});

export const projectUpdateSchema = projectInputSchema.partial();

export const skillInputSchema = z.object({
  title: nonEmpty(120),
  category: nonEmpty(80),
  experienceYears: z.coerce.number().min(0).max(80),
  proficiencyLevel: nonEmpty(40),
  description: nonEmpty(4000),
});

export const skillUpdateSchema = skillInputSchema.partial();

export const experienceInputSchema = z.object({
  companyOrProject: nonEmpty(160),
  role: nonEmpty(160),
  description: nonEmpty(4000),
  period: nonEmpty(80),
});

export const experienceUpdateSchema = experienceInputSchema.partial();

export const educationInputSchema = z.object({
  institution: nonEmpty(160),
  specialty: nonEmpty(160),
  details: nonEmpty(4000),
});

export const educationUpdateSchema = educationInputSchema.partial();

export const profileInputSchema = z.object({
  nameEn: nonEmpty(160),
  nameRu: nonEmpty(160),
  aboutEn: optionalText(4000).default(""),
  aboutRu: optionalText(4000).default(""),
});

export const profileUpdateSchema = profileInputSchema.partial();

export const profileItemInputSchema = z.object({
  labelEn: nonEmpty(80),
  labelRu: nonEmpty(80),
  value: nonEmpty(200),
  url: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .default("")
    .transform((value) => (value ? sanitizeProfileUrl(value) : "")),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const profileItemUpdateSchema = profileItemInputSchema.partial();

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const idParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type SkillInput = z.infer<typeof skillInputSchema>;
export type ExperienceInput = z.infer<typeof experienceInputSchema>;
export type EducationInput = z.infer<typeof educationInputSchema>;
export type TagLink = z.infer<typeof tagLinkSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfileItemInput = z.infer<typeof profileItemInputSchema>;
