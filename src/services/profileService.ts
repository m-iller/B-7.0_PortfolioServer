import { prisma } from "../db.js";
import type { ProfileInput, ProfileItemInput } from "../schemas/index.js";

export const PROFILE_ID = "main";

export async function ensureProfile() {
  const existing = await prisma.profile.findUnique({ where: { id: PROFILE_ID } });
  if (existing) return existing;
  return prisma.profile.create({
    data: {
      id: PROFILE_ID,
      nameEn: "Your Name",
      nameRu: "Ваше имя",
      aboutEn: "",
      aboutRu: "",
    },
  });
}

export async function getProfile() {
  await ensureProfile();
  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: PROFILE_ID } });
  const items = await prisma.profileItem.findMany({ orderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }] });
  return { ...profile, items };
}

export async function updateProfile(input: Partial<ProfileInput>) {
  await ensureProfile();
  return prisma.profile.update({
    where: { id: PROFILE_ID },
    data: input,
  });
}

export async function listProfileItems() {
  return prisma.profileItem.findMany({ orderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }] });
}

export async function createProfileItem(input: ProfileItemInput) {
  return prisma.profileItem.create({ data: input });
}

export async function updateProfileItem(id: string, input: Partial<ProfileItemInput>) {
  const existing = await prisma.profileItem.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.profileItem.update({ where: { id }, data: input });
}

export async function deleteProfileItem(id: string) {
  const existing = await prisma.profileItem.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.profileItem.delete({ where: { id } });
  return true;
}
