import libraryCreditsJson from "./library-credits.json";

/** Media library photos imported from Unsplash (scripts/import-unsplash-media.ts writes the JSON). */
export const libraryCredits = libraryCreditsJson as { id: string; author: string; username: string; topic: string }[];
