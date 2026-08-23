export const CITIES = [
  { slug: "bengaluru", label: "Bengaluru" },
  { slug: "mumbai", label: "Mumbai" },
  { slug: "delhi-ncr", label: "Delhi-NCR" },
  { slug: "hyderabad", label: "Hyderabad" },
  { slug: "chennai", label: "Chennai" },
  { slug: "pune", label: "Pune" },
  { slug: "kolkata", label: "Kolkata" },
] as const;

export function resolveCity(raw: string | undefined): string {
  return CITIES.some((c) => c.slug === raw) ? raw! : "bengaluru";
}
