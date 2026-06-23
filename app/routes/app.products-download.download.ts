/*
 * @Description: 
 * @Date: 2026-05-25 14:30
 * @LastEditTime: 2026-06-23 16:00
 */
import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";

export const loader = async () => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { folderName, products } = body;

    if (!folderName || !products || !Array.isArray(products)) {
      return new Response("Invalid request body", { status: 400 });
    }

    const downloadDir = path.join(os.tmpdir(), folderName);

    if (fs.existsSync(downloadDir)) {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(downloadDir, { recursive: true });

    let totalImageCount = 0;
    for (let p = 0; p < products.length; p++) {
      totalImageCount += products[p].images.length;
    }

    let cumulativeDownloaded = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productDir = sanitizeFolderName(product.title);
      const localProductDir = path.join(downloadDir, productDir);

      if (!fs.existsSync(localProductDir)) {
        fs.mkdirSync(localProductDir, { recursive: true });
      }

      for (let j = 0; j < product.images.length; j++) {
        const imageUrl = product.images[j];
        try {
          const urlObj = new URL(imageUrl);
          const pathname = urlObj.pathname;
          let originalFilename = pathname.split("/").pop() || "image";
          if (originalFilename.includes("?")) {
            originalFilename = originalFilename.split("?")[0];
          }

          let extension = "";
          if (originalFilename.includes(".")) {
            extension = originalFilename.split(".").pop() || "jpg";
          } else {
            extension = "jpg";
          }

          const baseName = originalFilename.replace(`.${extension}`, "");
          const imageFileName = `${String(j + 1).padStart(3, "0")}_${baseName}.${extension}`;
          const imagePath = path.join(localProductDir, imageFileName);

          const imageResponse = await fetch(imageUrl, {
            headers: { "Accept": "image/*" },
          });

          if (!imageResponse.ok) {
            cumulativeDownloaded++;
            continue;
          }

          const buffer = await imageResponse.arrayBuffer();
          fs.writeFileSync(imagePath, Buffer.from(buffer));

        } catch (error) {
          console.error(`Error downloading image ${imageUrl}:`, error);
        }

        cumulativeDownloaded++;
      }
    }

    const zipFileName = `${folderName}.zip`;
    const zipFilePath = path.join(os.tmpdir(), zipFileName);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err: Error) => {
        reject(err);
      });

      output.on("close", () => {
        resolve();
      });

      archive.directory(downloadDir, folderName);
      archive.pipe(output);
      archive.finalize();
    });

    const zipData = fs.readFileSync(zipFilePath);

    fs.rmSync(downloadDir, { recursive: true, force: true });
    fs.unlinkSync(zipFilePath);

    return new Response(zipData, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zipFileName)}"`,
        "Content-Length": zipData.length.toString(),
      },
    });

  } catch (error) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}