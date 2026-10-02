const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const uploadFolder = "uploads";

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

const upload = multer({
  dest: uploadFolder,
});

if (!process.env.ELEVENLABS_API_KEY) {
  console.warn("WARNING: ELEVENLABS_API_KEY is missing from .env");
}

app.get("/", (req, res) => {
  res.json({
    message: "Voice Clone Studio backend is running",
  });
});


/* ================================
   CREATE VOICE CLONE
================================ */

app.post(
  "/api/clone-voice",
  upload.single("voice"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No voice file was uploaded.",
        });
      }

      console.log("Uploaded file:");
      console.log({
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      });

      const audioBuffer = fs.readFileSync(req.file.path);

      const formData = new FormData();

      formData.append(
        "name",
        req.body.name || "My Voice Clone"
      );

      formData.append(
        "files[]",
        new Blob(
          [audioBuffer],
          {
            type: req.file.mimetype || "audio/mpeg",
          }
        ),
        req.file.originalname
      );

      console.log(
        "Sending voice sample to ElevenLabs..."
      );

      const response = await fetch(
        "https://api.elevenlabs.io/v1/voices/add",
        {
          method: "POST",
          headers: {
            "xi-api-key":
              process.env.ELEVENLABS_API_KEY,
          },
          body: formData,
        }
      );

      const responseText = await response.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          detail: responseText,
        };
      }

      console.log(
        "ElevenLabs status:",
        response.status
      );

      if (!response.ok) {
        console.error(
          "ElevenLabs clone error:",
          data
        );

        return res.status(response.status).json({
          error:
            data.detail ||
            data.message ||
            "ElevenLabs rejected the voice sample.",
        });
      }

      console.log(
        "Voice clone created successfully!"
      );

      console.log(
        "Voice ID:",
        data.voice_id
      );

      res.json({
        message:
          "Voice clone created successfully!",
        voiceId: data.voice_id,
        requiresVerification:
          data.requires_verification,
      });

      fs.unlinkSync(req.file.path);

    } catch (error) {
      console.error(
        "Clone server error:",
        error
      );

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: error.message,
      });
    }
  }
);


/* ================================
   GENERATE SPEECH
================================ */

app.post(
  "/api/generate-speech",
  async (req, res) => {
    try {
      const { voiceId, text } = req.body;

      console.log(
        "Voice ID:",
        voiceId
      );

      console.log(
        "Text:",
        text
      );

      if (!voiceId) {
        return res.status(400).json({
          error:
            "Voice ID is missing.",
        });
      }

      if (!text || !text.trim()) {
        return res.status(400).json({
          error:
            "Text is missing.",
        });
      }

      console.log(
        "Sending speech request to ElevenLabs..."
      );

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",

          headers: {
            "xi-api-key":
              process.env.ELEVENLABS_API_KEY,

            "Content-Type":
              "application/json",

            Accept:
              "audio/mpeg",
          },

          body: JSON.stringify({
            text: text,
            model_id:
              "eleven_multilingual_v2",
          }),
        }
      );

      console.log(
        "ElevenLabs speech status:",
        response.status
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        console.error(
          "ElevenLabs speech error:",
          errorText
        );

        return res.status(response.status).json({
          error:
            errorText ||
            "Speech generation failed.",
        });
      }

      const audioBuffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      console.log(
        "Audio received:",
        audioBuffer.length,
        "bytes"
      );

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.send(audioBuffer);

    } catch (error) {
      console.error(
        "Speech server error:",
        error
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);


/* ================================
   START SERVER
================================ */

app.listen(
  PORT,
  () => {
    console.log(
      `Voice Clone Server running at http://localhost:${PORT}`
    );
  }
);