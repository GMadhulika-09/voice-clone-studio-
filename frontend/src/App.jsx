import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [voiceFile, setVoiceFile] = useState(null);
  const [voiceId, setVoiceId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [text, setText] = useState(
    "Hello! This is my cloned voice speaking through Voice Clone Studio."
  );

  const [uploadStatus, setUploadStatus] = useState("");
  const [generateStatus, setGenerateStatus] = useState("");

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [audioUrl, setAudioUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const selectFile = (file) => {
    if (!file) return;

    const allowedTypes = [
      "audio/wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/x-m4a",
      "audio/ogg",
      "audio/flac",
      "audio/webm",
    ];

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    const allowedExtensions = [
      "wav",
      "mp3",
      "m4a",
      "ogg",
      "flac",
      "webm",
    ];

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(extension)
    ) {
      setUploadStatus(
        "Please upload a WAV, MP3, M4A, OGG, FLAC or WEBM file."
      );
      return;
    }

    setVoiceFile(file);
    setVoiceId("");
    setTranscript("");
    setUploadStatus("");
    setGenerateStatus("");
    setAudioUrl("");
  };

  const handleFileChange = (event) => {
    selectFile(event.target.files[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];
    selectFile(file);
  };

  const uploadVoice = async () => {
    if (!voiceFile) {
      setUploadStatus("Please select a voice recording first.");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading and analyzing your voice...");
    setVoiceId("");
    setTranscript("");
    setAudioUrl("");
    setGenerateStatus("");

    try {
      const formData = new FormData();

      formData.append("voice", voiceFile);

      const response = await fetch(
        `${API_URL}/upload-voice`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Voice upload failed."
        );
      }

      setVoiceId(data.voice_id);
      setTranscript(data.transcript);

      setUploadStatus(
        "Voice uploaded and analyzed successfully!"
      );
    } catch (error) {
      console.error(error);

      setUploadStatus(
        `Error: ${error.message}`
      );
    } finally {
      setUploading(false);
    }
  };

  const generateVoice = async () => {
    if (!voiceId) {
      setGenerateStatus(
        "Upload and analyze your voice first."
      );
      return;
    }

    if (!text.trim()) {
      setGenerateStatus(
        "Please enter some text."
      );
      return;
    }

    setGenerating(true);
    setGenerateStatus(
      "Generating speech in your cloned voice..."
    );

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }

    try {
      const formData = new FormData();

      formData.append("voice_id", voiceId);
      formData.append("text", text.trim());

      const response = await fetch(
        `${API_URL}/clone`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let message = "Voice generation failed.";

        try {
          const data = await response.json();
          message = data.detail || message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const audioBlob = await response.blob();

      const generatedUrl =
        URL.createObjectURL(audioBlob);

      setAudioUrl(generatedUrl);

      setGenerateStatus(
        "Your cloned voice is ready!"
      );
    } catch (error) {
      console.error(error);

      setGenerateStatus(
        `Error: ${error.message}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const resetVoice = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setVoiceFile(null);
    setVoiceId("");
    setTranscript("");
    setUploadStatus("");
    setGenerateStatus("");
    setAudioUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="app">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className="header">

        <div className="logo">
          <div className="logo-icon">◉</div>
          <span>Voice Clone Studio</span>
        </div>

        <div className="header-badge">
          Qwen3-TTS · Local AI
        </div>

      </header>


      {/* ================================================= */}
      {/* HERO */}
      {/* ================================================= */}

      <section className="hero">

        <div className="hero-badge">
          ✦ PERSONAL VOICE AI
        </div>

        <h1>
          Your Voice.
          <br />
          <span>Powered by AI.</span>
        </h1>

        <p>
          Upload a voice recording, enter your text,
          and generate natural speech using that voice.
        </p>

      </section>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      <main className="main">


        {/* ================================================= */}
        {/* STEP 01 */}
        {/* ================================================= */}

        <section className="card">

          <div className="card-number">
            01
          </div>

          <div className="card-content">

            <div className="section-label">
              VOICE REFERENCE
            </div>

            <h2>
              Upload a voice
            </h2>

            <p className="description">
              Upload a clear recording of the voice
              you have permission to clone.
            </p>


            {/* UPLOAD AREA */}

            {!voiceFile ? (

              <div
                className={`upload-area ${
                  dragging ? "dragging" : ""
                }`}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => {
                  setDragging(false);
                }}
                onDrop={handleDrop}
              >

                <div className="upload-icon">
                  🎙️
                </div>

                <h3>
                  Drop your voice recording here
                </h3>

                <p>
                  or click to browse your computer
                </p>

                <span className="file-types">
                  WAV · MP3 · M4A · OGG · FLAC · WEBM
                </span>

              </div>

            ) : (

              <div className="selected-file">

                <div className="file-icon">
                  🎵
                </div>

                <div className="file-info">

                  <strong>
                    {voiceFile.name}
                  </strong>

                  <span>
                    {(voiceFile.size / 1024 / 1024).toFixed(2)}
                    {" MB"}
                  </span>

                </div>

                <button
                  className="remove-button"
                  onClick={resetVoice}
                  type="button"
                >
                  ×
                </button>

              </div>

            )}


            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.ogg,.flac,.webm,audio/*"
              onChange={handleFileChange}
              hidden
            />


            {/* UPLOAD BUTTON */}

            {voiceFile && !voiceId && (

              <button
                className="primary-button"
                onClick={uploadVoice}
                disabled={uploading}
              >

                {uploading
                  ? "Analyzing Voice..."
                  : "🧠 Analyze Voice"}

              </button>

            )}


            {/* UPLOAD STATUS */}

            {uploadStatus && (

              <div
                className={`status-message ${
                  voiceId
                    ? "success"
                    : "error"
                }`}
              >
                {uploadStatus}
              </div>

            )}


            {/* TRANSCRIPT */}

            {transcript && (

              <div className="transcript-box">

                <div className="transcript-title">
                  Detected speech
                </div>

                <p>
                  {transcript}
                </p>

              </div>

            )}

          </div>

        </section>


        {/* ================================================= */}
        {/* STEP 02 */}
        {/* ================================================= */}

        <section className="card">

          <div className="card-number">
            02
          </div>

          <div className="card-content">

            <div className="section-label">
              SPEECH GENERATION
            </div>

            <h2>
              Create your voice
            </h2>

            <p className="description">
              Enter anything you want your cloned
              voice to say.
            </p>


            <textarea
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              placeholder="Type something for your cloned voice to say..."
              rows="7"
              disabled={!voiceId}
            />


            <button
              className="primary-button"
              onClick={generateVoice}
              disabled={
                generating ||
                !voiceId
              }
            >

              {generating
                ? "Generating Voice..."
                : "🔊 Generate Cloned Speech"}

            </button>


            {!voiceId && (

              <div className="hint">
                Upload and analyze a voice above first.
              </div>

            )}


            {generateStatus && (

              <div
                className={`status-message ${
                  audioUrl
                    ? "success"
                    : "error"
                }`}
              >
                {generateStatus}
              </div>

            )}


            {/* AUDIO RESULT */}

            {audioUrl && (

              <div className="audio-result">

                <div className="audio-result-header">

                  <div>

                    <span className="result-label">
                      GENERATED VOICE
                    </span>

                    <h3>
                      Your cloned speech
                    </h3>

                  </div>

                  <span className="ready-dot">
                    ● READY
                  </span>

                </div>


                <audio
                  controls
                  src={audioUrl}
                />


                <a
                  className="download-button"
                  href={audioUrl}
                  download="cloned-voice.wav"
                >
                  ↓ Download Audio
                </a>

              </div>

            )}

          </div>

        </section>

      </main>


      {/* ================================================= */}
      {/* CAPABILITIES */}
      {/* ================================================= */}

      <section className="capabilities">

        <div className="section-heading">

          <div className="section-label">
            CAPABILITIES
          </div>

          <h2>
            One voice. Many possibilities.
          </h2>

        </div>


        <div className="capability-grid">

          <div className="capability">

            <span>01</span>

            <h3>
              Voice Cloning
            </h3>

            <p>
              Create natural speech using an
              uploaded reference voice.
            </p>

          </div>


          <div className="capability">

            <span>02</span>

            <h3>
              Text → Speech
            </h3>

            <p>
              Turn any written sentence into
              generated speech.
            </p>

          </div>


          <div className="capability">

            <span>03</span>

            <h3>
              Automatic Transcription
            </h3>

            <p>
              Whisper automatically detects
              what was spoken in the recording.
            </p>

          </div>


          <div className="capability">

            <span>04</span>

            <h3>
              Local AI
            </h3>

            <p>
              Voice processing runs locally on
              the computer using your GPU.
            </p>

          </div>

        </div>

      </section>


      {/* ================================================= */}
      {/* PIPELINE */}
      {/* ================================================= */}

      <section className="architecture">

        <div className="section-label">
          UNDER THE HOOD
        </div>

        <h2>
          How it works
        </h2>


        <div className="pipeline">

          <div className="pipeline-item">

            <div className="pipeline-icon">
              🎤
            </div>

            <span>
              Reference Voice
            </span>

          </div>


          <div className="pipeline-arrow">
            →
          </div>


          <div className="pipeline-item">

            <div className="pipeline-icon">
              📝
            </div>

            <span>
              Whisper
            </span>

          </div>


          <div className="pipeline-arrow">
            →
          </div>


          <div className="pipeline-item">

            <div className="pipeline-icon">
              🧠
            </div>

            <span>
              Qwen3-TTS
            </span>

          </div>


          <div className="pipeline-arrow">
            →
          </div>


          <div className="pipeline-item">

            <div className="pipeline-icon">
              🔊
            </div>

            <span>
              Cloned Speech
            </span>

          </div>

        </div>

      </section>


      {/* ================================================= */}
      {/* FOOTER */}
      {/* ================================================= */}

      <footer>

        <span>
          Voice Clone Studio
        </span>

        <span>
          Built with Qwen3-TTS + Whisper
        </span>

      </footer>

    </div>
  );
}

export default App;