export function formatDate(date: string | number | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function compressImage(
  file: File | Blob,
  maxWidth = 1920,
  quality = 0.7,
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = String(event.target?.result ?? "");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
}

// "3 months ago" style relative time, like the mockup's note rows.
const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(date: string | number | Date | undefined): string {
  if (date === undefined) return "";
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = (then - Date.now()) / 1000;
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diffSec) >= secs) {
      return RTF.format(Math.round(diffSec / secs), unit);
    }
  }
  return "just now";
}

// Turn a note title into a file-name-ish label: "My Ideas!" -> "my-ideas.js"
export function toFileName(
  title: string | null | undefined,
  fallback = "untitled",
): string {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `${slug || fallback}.js`;
}
