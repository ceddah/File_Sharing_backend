import express from "express";
import multer from "multer";
import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import File from "../models/File";
import https from "https";
import nodemailer from "nodemailer";
const nodemailerSendgrid = require("nodemailer-sendgrid");
import { createEmailTemplate } from "../utils/createEmailTemplate";

const router = express.Router();
const storage = multer.diskStorage({});
let upload = multer({
  storage,
});

router.post("/upload", upload.single("myFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Error Occurred, couldn't get the file." });
    }
    let uploadedFile: UploadApiResponse;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: "shareme",
        resource_type: "auto",
      });
    } catch (error) {
      const { message } = error as Error;
      console.log(message);
      res.status(400).json({ message: "Cloudinary Error" });
    }

    const { originalname } = req.file;
    const { secure_url, bytes, format } = uploadedFile!;
    const file = await File.create({
      filename: originalname,
      sizeInBytes: bytes,
      secure_url,
      format,
    });

    res.status(200).json({
      id: file._id,
      downloadPageLink: `${process.env.API_BASE_ENDPOINT_CLIENT}download/${file._id}`,
    });
  } catch (error) {
    const { message } = error as Error;
    console.log(message);
    res.status(500).json({ message: "Server Error has occurred..." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: "File does not exist." });
    }

    return res.status(200).json({
      name: file.filename,
      format: file.format,
      sizeInBytes: file.sizeInBytes,
      id: file.id,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error has occurred." });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const id = req.params.id;
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: "File does not exist." });
    }

    https.get(file.secure_url, (fileStream) => {
      fileStream.pipe(res);
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error has occurred." });
  }
});

router.post("/email", async (req, res) => {
  const { id, emailFrom, emailTo } = req.body;
  const file = await File.findById(id);
  if (!file) {
    return res.status(404).json({ message: "File does not exist." });
  }
  let transporter = nodemailer.createTransport(
    nodemailerSendgrid({
      apiKey: process.env.SEND_GRID_API_KEY,
    })
  );

  const { filename, sizeInBytes } = file;
  const fileSize = `${(+sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  const downloadPageLink = `${process.env.API_BASE_ENDPOINT_CLIENT}download/${id}`;
  const mailOptions = {
    from: "cedanik1@gmail.com",
    to: emailTo,
    subject: "File shared with you ✔",
    text: `${emailFrom} shared a file with you!`,
    html: createEmailTemplate(emailFrom, downloadPageLink, filename, fileSize),
  };

  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: "Server error has occurred." });
    }
    file.sender = emailFrom;
    file.receiver = emailTo;
    await file.save();

    return res
      .status(200)
      .json({ message: "Email was sent to the specified receiver." });
  });
});

export default router;
