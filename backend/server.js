require("dotenv").config();
const express = require("express");
const app = express();
const port = 3000;
const {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  fontkit,
} = require("pdf-lib");
const fs = require("fs").promises;
const fs2 = require("fs");
const crypto = require("crypto");
const sharp = require("sharp");
const mintToken = require("./controllers/mintNFT");
const moment = require("moment");
const archiver = require("archiver");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

app.use(express.json());
app.use(cors());

async function createPdfFromContent(payload) {
  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage();

  for (const item of payload) {
    const { width, height } = currentPage.getSize();
    const maxWidth = width - 100;
    const fontSize = 12;

    if (item.type === "serverId") {
      currentPage.drawText(item.text, {
        x: 50, //shorter side
        y: height - 3 * fontSize, //longer side
        size: fontSize,
      });
    } else if (item.type === "channelId") {
      currentPage.drawText(item.text, {
        x: 50, //shorter side
        y: height - 4 * fontSize,
        size: fontSize,
      });
    } else if (item.type === "time") {
      currentPage = pdfDoc.addPage();
      let date = moment(item.text).format("llll");
      currentPage.drawText(`Time: ${date}`, {
        x: 50, //shorter side
        y: height - 3 * fontSize,
        size: 12,
      });
    } else if (item.type === "prompt") {
      // Wrap text to the next line if it exceeds maxWidth
      const textLines = splitTextIntoLines(item.text, maxWidth, fontSize);

      // Add text to PDF
      // currentPage.drawText(item.text, {
      //   x: 50, //shorter side
      //   y: height - 4 * fontSize,
      //   size: 12,
      // });
      for (let i = 0; i < textLines.length; i++) {
        currentPage.drawText(textLines[i], {
          x: 50,
          y: height - 4 * fontSize,
          size: 12,
        });
      }
    } else if (item.type === "image") {
      // Fetch the image from the URL
      try {
        const response = await axios.get(item.url, {
          responseType: "arraybuffer",
        });

        const imageBytes = response.data;

        // Convert WebP to PNG using sharp
        let dims = 450;
        let pngBuffer;
        try {
          pngBuffer = await sharp(Buffer.from(imageBytes))
            .png()
            .resize({ width: dims, height: dims })
            .toBuffer();
        } catch (error) {
          continue;
        }

        // Add image to PDF
        const pngImage = await pdfDoc.embedPng(pngBuffer, {
          keepPngColorProfile: true,
        });

        currentPage.drawImage(pngImage, {
          x: width / 2 - pngImage.width / 2,
          y: height - 6 * fontSize - pngImage.height,
          width: pngImage.width,
          height: pngImage.height,
        });
      } catch (error) {
        console.error(`Failed to fetch or process image: ${item.url}`, error);
      }
    }
  }

  // Ensure the storage directory exists
  const storageDir = path.join(__dirname, "storage");

  // Generate unique filename with a timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `creative-process-${timestamp}.pdf`;

  // Save the PDF in the storage directory
  const filePath = path.join(storageDir, fileName);
  const pdfBytes = await pdfDoc.save();

  // Define a path for the PDF file
  // const filePath = "./storage/creative-process.pdf";

  // Save the PDF to the server's filesystem
  await fs.writeFile(filePath, pdfBytes);

  return { filePath, fileName };
}

// hash PDF
async function hashPdf(buffer) {
  try {
    // Read the PDF file
    const hash = crypto.createHash("sha256");
    const pdfHash = hash.update(buffer).digest("hex");

    return pdfHash;
  } catch (error) {
    console.error("Error hashing the PDF:", error);
    throw error;
  }
}

// Create certificate of timestamping
async function createCertificate(txD, txH, uri) {
  const pdfDoc = await PDFDocument.create();
  let epoch = txD + 946684800;
  let date = moment(epoch * 1000).format("llll");
  const page = pdfDoc.addPage();
  page.drawText(
    `Certificate of timestamp \n` +
      `Your artwork and your creative process have been recorded; \n` +
      `Date and time: ${date} \n` +
      `Find your timestamp on XRPL using the hash: ${txH} \n` +
      `The hash of your creative process: ${uri}`,
    {
      x: 100, //shorter side
      y: 100, //longer side
      size: 12,
      rotate: degrees(+90),
    }
  );
  const pdfBytes = await pdfDoc.save();

  // Ensure the storage directory exists
  const storageDir = path.join(__dirname, "storage");

  // Generate unique filename with a timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `certificate-of-timestamp-${timestamp}.pdf`;

  const filePath = path.join(storageDir, fileName);
  await fs.writeFile(filePath, pdfBytes);

  return { filePath, fileName };
}

// Zip files
async function zipFiles(files) {
  // Ensure the storage directory exists
  const storageDir = path.join(__dirname, "storage");

  // Generate unique filename with a timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `combined-docs-${timestamp}.zip`;

  // Define the output path for the zip file
  const outputPath = path.join(storageDir, fileName);

  return new Promise((resolve, reject) => {
    const output = fs2.createWriteStream(outputPath);

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", function () {
      resolve(outputPath);
      console.log(`Zip file has been written to ${outputPath}.`);
    });

    output.on("finish", function () {
      console.log("Output stream finished writing.");
    });

    output.on("error", function (err) {
      console.error("Stream error:", err);
      reject(err);
    });

    archive.on("end", function () {
      console.log("Archive stream ended.");
    });

    archive.on("error", function (err) {
      console.error("Archiver error:", err);
      reject(err);
    });

    archive.pipe(output);

    for (const file of files) {
      archive.append(fs2.createReadStream(file.path), { name: file.name });
    }

    archive.finalize();
  });
}

app.post("/creative-process", async (req, res) => {
  const { promptsAndUrls: payload } = req.body;
  console.log("Starting PDF creation...");

  try {
    //create the creative process PDF
    const { filePath: pdfPath, fileName: pdfFileName } =
      await createPdfFromContent(payload);

    // Hash the pdf
    const pdfBuffer = await fs.readFile(pdfPath);
    const hash = await hashPdf(pdfBuffer);

    //mint the NFT
    const { txDate, txHash, txURI } = await mintToken(hash);

    // create the certificate of timestamp:
    const { filePath: certPath, fileName: certFileName } =
      await createCertificate(txDate, txHash, txURI);

    // create the zip
    const filesToZip = [
      { path: pdfPath, name: pdfFileName },
      { path: certPath, name: certFileName },
    ];

    // const zipPath = "./storage/creative-process.zip";
    const zipPath = await zipFiles(filesToZip);
    console.log(`Zip file saved to server: ${zipPath}`);

    // Send the PDF file back in the response
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=creative-process.zip"
    );
    res.setHeader("Content-Type", "application/zip");
    res.sendFile(
      zipPath,
      // {
      //   root: __dirname,
      // },
      function (err) {
        if (err) {
          console.log(err);
          res.status(500).send("An error occurred");
        } else {
          console.log("Zip file sent to the user.");
        }
      }
    );
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error processing your request", error: error.message });
  }
});

app.post("/final-work", async (req, res) => {
  const { imageUrl } = req.body;
  console.log("Starting PDF creation...");

  if (!imageUrl) {
    return res
      .status(400)
      .json({ error: "Missing 'text' field containing the image URL." });
  }

  try {
    // Fetch the image data
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = response.data;

    // Create a hash of the image data
    const hash = await hashPdf(imageBuffer);

    // Mint the NFT
    const { txDate, txHash, txURI } = await mintToken(hash);

    // Create the certificate of timestamping
    const certPath = await createCertificate(txDate, txHash, txURI);

    res.setHeader("Content-Disposition", "attachment; filename=final-work.pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(
      certPath,
      {
        root: __dirname,
      },
      function (err) {
        if (err) {
          console.log(err);
          res.status(500).send("An error occurred");
        } else {
          console.log("Zip file sent to the user.");
        }
      }
    );
  } catch (error) {
    console.error("Error fetching or hashing the image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// Helper functions

function splitTextIntoLines(text, maxWidth, fontSize) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const newLine = currentLine.trim() + (currentLine.trim() ? " " : "") + word;
    const textWidth = getTextWidth(text, fontSize);

    if (textWidth > maxWidth) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = newLine;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}

async function getTextWidth(text, fontSize) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  return textWidth;
}
