// Destinations without zod: imported by client components (tour list filters) to keep zod out of public pages.

export const DESTINATIONS = ["ha-long", "ninh-binh", "sapa"] as const;
export type Destination = (typeof DESTINATIONS)[number];
export const isDestination = (slug: string): slug is Destination => (DESTINATIONS as readonly string[]).includes(slug);
