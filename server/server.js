const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = 5000;

// ======================================================
// PATHS
// ======================================================

const SERVER_DIR = __dirname;
const PROJECT_DIR = path.join(SERVER_DIR, "..");

const UPLOAD_DIR = path.join(SERVER_DIR, "uploads");
const PYTHON_DIR = path.join(PROJECT_DIR, "python");

const REFERENCE_AUDIO = path.join(
  UPLOAD_DIR,
  "reference.wav"
);

const OUTPUT_AUDIO = path.join(
  PYTHON_DIR,
  "output.wav"
);

const PYTHON_EXE = path.join(
  PROJECT_DIR,
  ".venv",
  "Scripts",
  "python.exe"
);

// ======================================================
// WORKING BTBN FFMPEG
// ======================================================

const FFMPEG = String.raw`C:\Users\gnvpm\AppData\Local\Microsoft\WinGet\Packages\BtbN.FFmpeg.GPL.Shared_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-N-126342-gf88b741dbf-win64-gpl-shared\bin\ffmpeg.exe`;

// ======================================================
// CREATE REQUIRED DIRECTORIES
// ======================================================

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(PYTHON_DIR)) {
  fs.mkdirSync(PYTHON_DIR, { recursive: true });
}

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// ======================================================
// MULTER UPLOAD
// ======================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    // Let multer create a temporary filename.
    // We convert it to reference.wav afterward.
    const uniqueName =
      Date.now() +
      "-" +
      Math.random().toString(16).slice(2);

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB
  },
});

// ======================================================
// CHECK FFMPEG
// ======================================================

function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    console.log("\nChecking FFmpeg...");
    console.log("FFmpeg path:");
    console.log(FFMPEG);

    if (!fs.existsSync(FFMPEG)) {
      reject(
        new Error(
          "FFmpeg executable was not found at:\n" + FFMPEG
        )
      );
      return;
    }

    const process = spawn(
      FFMPEG,
      ["-version"],
      {
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      console.log("FFmpeg check exit code:", code);

      if (code === 0) {
        console.log(
          stdout.split("\n")[0]
        );

        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg test failed with exit code ${code}\n${stderr}`
          )
        );
      }
    });
  });
}

// ======================================================
// CONVERT ANY AUDIO/VIDEO FILE TO WAV
// ======================================================

function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log("\n=================================");
    console.log("FFMPEG AUDIO CONVERSION");
    console.log("=================================");

    console.log("FFmpeg:");
    console.log(FFMPEG);

    console.log("\nInput:");
    console.log(inputPath);

    console.log("\nOutput:");
    console.log(outputPath);

    const args = [
      "-y",
      "-i",
      inputPath,

      // Ignore video stream if the uploaded file contains video.
      "-vn",

      // Mono
      "-ac",
      "1",

      // Qwen reference audio sample rate
      "-ar",
      "24000",

      // WAV PCM
      "-c:a",
      "pcm_s16le",

      outputPath,
    ];

    console.log("\nFFmpeg arguments:");
    console.log(args);

    const ffmpegProcess = spawn(
      FFMPEG,
      args,
      {
        windowsHide: true,
      }
    );

    let stderr = "";
    let stdout = "";

    ffmpegProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffmpegProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on("error", (error) => {
      console.error(
        "\nFFmpeg PROCESS ERROR:"
      );
      console.error(error);

      reject(error);
    });

    ffmpegProcess.on("close", (code) => {
      console.log(
        "\nFFmpeg exited with code:",
        code
      );

      if (stderr.trim()) {
        console.log(
          "\n========== FFMPEG STDERR =========="
        );
        console.log(stderr);
        console.log(
          "===================================="
        );
      }

      if (code !== 0) {
        reject(
          new Error(
            `FFmpeg failed with exit code ${code}.\n${stderr}`
          )
        );
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(
          new Error(
            "FFmpeg finished successfully, but output WAV was not created."
          )
        );
        return;
      }

      console.log(
        "\nWAV conversion completed successfully."
      );

      resolve(outputPath);
    });
  });
}

// ======================================================
// RUN QWEN PYTHON
// ======================================================

function runQwen(referenceAudio, text, outputAudio) {
  return new Promise((resolve, reject) => {
    console.log("\n=================================");
    console.log("STARTING QWEN3-TTS");
    console.log("=================================");

    console.log("Python:");
    console.log(PYTHON_EXE);

    console.log("Reference:");
    console.log(referenceAudio);

    console.log("Text:");
    console.log(text);

    console.log("Output:");
    console.log(outputAudio);

    if (!fs.existsSync(PYTHON_EXE)) {
      reject(
        new Error(
          "Python executable not found:\n" +
          PYTHON_EXE
        )
      );
      return;
    }

    const pythonProcess = spawn(
      PYTHON_EXE,
      [
        path.join(
          PROJECT_DIR,
          "python",
          "generate_clone.py"
        ),

        referenceAudio,
        text,
        outputAudio,
      ],
      {
        cwd: PROJECT_DIR,
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const message = data.toString();

      stdout += message;

      console.log(
        "[QWEN]",
        message.trim()
      );
    });

    pythonProcess.stderr.on("data", (data) => {
      const message = data.toString();

      stderr += message;

      console.error(
        "[QWEN ERROR]",
        message.trim()
      );
    });

    pythonProcess.on("error", (error) => {
      console.error(
        "Python process error:",
        error
      );

      reject(error);
    });

    pythonProcess.on("close", (code) => {
      console.log(
        "\nQwen process exited with code:",
        code
      );

      if (code !== 0) {
        reject(
          new Error(
            `Qwen generation failed with exit code ${code}.\n${stderr || stdout}`
          )
        );

        return;
      }

      if (!fs.existsSync(outputAudio)) {
        reject(
          new Error(
            "Qwen completed but output.wav was not created."
          )
        );

        return;
      }

      console.log(
        "\nQwen voice generation completed."
      );

      resolve(outputAudio);
    });
  });
}

// ======================================================
// TEST ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.json({
    message: "Voice Clone Server is running",
    backend: "Node.js",
    ttsEngine: "Qwen3-TTS 0.6B",
    elevenLabs: false,
    ffmpeg: FFMPEG,
  });
});

// ======================================================
// CLONE VOICE
// ======================================================

app.post(
  "/api/clone-voice",
  upload.single("voice"),
  async (req, res) => {
    try {
      console.log("\n=================================");
      console.log("VOICE UPLOAD REQUEST");
      console.log("=================================");

      if (!req.file) {
        return res.status(400).json({
          error: "Please upload an audio file.",
        });
      }

      const uploadedFile = req.file.path;

      console.log(
        "Temporary uploaded file:"
      );
      console.log(uploadedFile);

      console.log(
        "\nTarget reference file:"
      );
      console.log(REFERENCE_AUDIO);

      // Remove old reference file.
      if (fs.existsSync(REFERENCE_AUDIO)) {
        fs.unlinkSync(REFERENCE_AUDIO);
      }

      console.log(
        "\nConverting uploaded file to reference.wav..."
      );

      await convertToWav(
        uploadedFile,
        REFERENCE_AUDIO
      );

      // Remove temporary upload.
      if (fs.existsSync(uploadedFile)) {
        fs.unlinkSync(uploadedFile);
      }

      console.log(
        "\nVoice uploaded and converted successfully."
      );

      res.json({
        success: true,
        voiceId: "local-qwen-voice",
        message:
          "Voice uploaded successfully and converted for Qwen3-TTS.",
      });
    } catch (error) {
      console.error(
        "\nVOICE UPLOAD ERROR:"
      );

      console.error(error);

      // Try to clean temporary file.
      if (req.file?.path) {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch {}
      }

      res.status(500).json({
        error:
          error.message ||
          "Voice upload failed.",
      });
    }
  }
);

// ======================================================
// GENERATE SPEECH
// ======================================================

app.post(
  "/api/generate-speech",
  async (req, res) => {
    try {
      console.log("\n=================================");
      console.log("GENERATE SPEECH REQUEST");
      console.log("=================================");

      const { voiceId, text } = req.body;

      if (!voiceId) {
        return res.status(400).json({
          error: "voiceId is required.",
        });
      }

      if (!text || !text.trim()) {
        return res.status(400).json({
          error: "Text is required.",
        });
      }

      if (!fs.existsSync(REFERENCE_AUDIO)) {
        return res.status(400).json({
          error:
            "No reference voice found. Please upload your voice first.",
        });
      }

      // Remove old output if it exists.
      if (fs.existsSync(OUTPUT_AUDIO)) {
        try {
          fs.unlinkSync(OUTPUT_AUDIO);
        } catch {}
      }

      await runQwen(
        REFERENCE_AUDIO,
        text.trim(),
        OUTPUT_AUDIO
      );

      console.log(
        "\nSending generated WAV to frontend..."
      );

      res.setHeader(
        "Content-Type",
        "audio/wav"
      );

      res.setHeader(
        "Content-Disposition",
        'inline; filename="generated-voice.wav"'
      );

      const audioStream =
        fs.createReadStream(
          OUTPUT_AUDIO
        );

      audioStream.pipe(res);

      audioStream.on("error", (error) => {
        console.error(
          "Audio streaming error:",
          error
        );

        if (!res.headersSent) {
          res.status(500).json({
            error:
              "Failed to send generated audio.",
          });
        }
      });
    } catch (error) {
      console.error(
        "\nSPEECH GENERATION ERROR:"
      );

      console.error(error);

      res.status(500).json({
        error:
          error.message ||
          "Speech generation failed.",
      });
    }
  }
);

// ======================================================
// START SERVER
// ======================================================

async function startServer() {
  try {
    await checkFFmpeg();

    app.listen(PORT, () => {
      console.log("\n=================================");
      console.log(
        `Voice Clone Server running at http://localhost:${PORT}`
      );
      console.log("Backend: Node.js");
      console.log("TTS Engine: Qwen3-TTS 0.6B");
      console.log("ElevenLabs: NOT USED");
      console.log("FFmpeg: BtbN GPL Shared");
      console.log("=================================\n");
    });
  } catch (error) {
    console.error(
      "\nSERVER STARTUP ERROR:"
    );

    console.error(error);

    process.exit(1);
  }
}

startServer();