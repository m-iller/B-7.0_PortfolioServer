export interface TagLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  titleEn: string;
  titleRu: string;
  descriptionEn: string;
  descriptionRu: string;
  images: string[];
  videos: string[];
  tagsLinks: TagLink[];
  youtubeUrl: string;
  youtubeEmbed: string | null;
  createdAt: string;
}

export interface Skill {
  id: string;
  titleEn: string;
  titleRu: string;
  categoryEn: string;
  categoryRu: string;
  experienceYears: number;
  proficiencyLevelEn: string;
  proficiencyLevelRu: string;
  descriptionEn: string;
  descriptionRu: string;
}

export interface Experience {
  id: string;
  companyOrProjectEn: string;
  companyOrProjectRu: string;
  roleEn: string;
  roleRu: string;
  descriptionEn: string;
  descriptionRu: string;
  period: string;
}

export interface ProfileItem {
  id: string;
  labelEn: string;
  labelRu: string;
  value: string;
  url: string;
  sortOrder: number;
}

export interface Profile {
  id: string;
  nameEn: string;
  nameRu: string;
  aboutEn: string;
  aboutRu: string;
  items: ProfileItem[];
}

export interface Education {
  id: string;
  institutionEn: string;
  institutionRu: string;
  specialtyEn: string;
  specialtyRu: string;
  detailsEn: string;
  detailsRu: string;
}
