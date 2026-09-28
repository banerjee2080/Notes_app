export function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function compressImage(file, maxWidth = 1920, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
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
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
}

// "3 months ago" style relative time, like the mockup's note rows.
const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];
export function timeAgo(date) {
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
export function toFileName(title, fallback = "untitled") {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `${slug || fallback}.js`;
}
