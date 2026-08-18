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
  title: string;
  category: string;
  experienceYears: number;
  proficiencyLevel: string;
  description: string;
}

export interface Experience {
  id: string;
  companyOrProject: string;
  role: string;
  description: string;
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
  institution: string;
  specialty: string;
  details: string;
}
