import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import * as cheerio from "cheerio";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const processHtmlImages = async (htmlContent) => {
  if (!htmlContent || !htmlContent.includes("data:image")) return htmlContent;

  const $ = cheerio.load(htmlContent, null, false);
  const images = $("img").toArray();

  for (const img of images) {
    const src = $(img).attr("src");

    if (src && src.startsWith("data:image")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(src, {
          folder: "notes_app_sync",
        });

        $(img).attr("src", uploadResponse.secure_url);
      } catch (error) {
        console.error("Failed to upload synced image to Cloudinary", error);
      }
    }
  }

  // Return the cleaned HTML string
  return $.html();
};

export default cloudinary;
