import { ChapterPayload } from "../types";

function buildImages(chapterId: string, count: number): string[] {
  return Array.from({ length: count }).map(
    (_, index) => `https://cdn.example.com/chapters/${chapterId}/${index + 1}.webp`,
  );
}

export const demoChapters: ChapterPayload[] = [
  {
    titleId: "title-a",
    titleName: "Abyss Runner",
    titleCoverUrl: "https://cdn.example.com/covers/title-a.webp",
    chapterId: "a-101",
    chapterNumber: "101",
    chapterName: "Night Entry",
    imageUrls: buildImages("a-101", 26),
    headers: {
      Authorization: "Bearer demo-token",
      Referer: "https://example.com",
    },
  },
  {
    titleId: "title-a",
    titleName: "Abyss Runner",
    titleCoverUrl: "https://cdn.example.com/covers/title-a.webp",
    chapterId: "a-102",
    chapterNumber: "102",
    chapterName: "Echoes",
    imageUrls: buildImages("a-102", 22),
    headers: {
      Authorization: "Bearer demo-token",
      Referer: "https://example.com",
    },
  },
  {
    titleId: "title-b",
    titleName: "Skyline Protocol",
    titleCoverUrl: "https://cdn.example.com/covers/title-b.webp",
    chapterId: "b-12",
    chapterNumber: "12",
    chapterName: "Vector Lock",
    imageUrls: buildImages("b-12", 31),
    headers: {
      Authorization: "Bearer demo-token",
      Referer: "https://example.com",
    },
  },
  {
    titleId: "title-c",
    titleName: "Golem Rain",
    titleCoverUrl: "https://cdn.example.com/covers/title-c.webp",
    chapterId: "c-44",
    chapterNumber: "44",
    chapterName: "Zero Plateau",
    imageUrls: buildImages("c-44", 18),
    headers: {
      Authorization: "Bearer demo-token",
      Referer: "https://example.com",
    },
  },
];
