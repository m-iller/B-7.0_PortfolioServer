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
  titleEn: nonEmpty(120),
  titleRu: nonEmpty(120),
  categoryEn: nonEmpty(80),
  categoryRu: nonEmpty(80),
  experienceYears: z.coerce.number().min(0).max(80),
  proficiencyLevelEn: nonEmpty(40),
  proficiencyLevelRu: nonEmpty(40),
  descriptionEn: nonEmpty(4000),
  descriptionRu: nonEmpty(4000),
});

export const skillUpdateSchema = skillInputSchema.partial();

export const experienceInputSchema = z.object({
  companyOrProjectEn: nonEmpty(160),
  companyOrProjectRu: nonEmpty(160),
  roleEn: nonEmpty(160),
  roleRu: nonEmpty(160),
  descriptionEn: nonEmpty(4000),
  descriptionRu: nonEmpty(4000),
  period: nonEmpty(80),
});

export const experienceUpdateSchema = experienceInputSchema.partial();

export const educationInputSchema = z.object({
  institutionEn: nonEmpty(160),
  institutionRu: nonEmpty(160),
  specialtyEn: nonEmpty(160),
  specialtyRu: nonEmpty(160),
  detailsEn: nonEmpty(4000),
  detailsRu: nonEmpty(4000),
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
