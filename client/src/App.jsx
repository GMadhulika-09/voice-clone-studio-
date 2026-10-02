import { useState } from "react";
import "./App.css";

function App() {
  const [voiceFile, setVoiceFile] = useState(null);
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState(
    "Hello! This is my AI voice clone. Welcome to Voice Clone Studio."
  );
  const [audioUrl, setAudioUrl] = useState("");
  const [status, setStatus] = useState("");

  const cloneVoice = async () => {
    if (!voiceFile) {
      setStatus("Please select an MP3 voice recording first.");
      return;
    }

    setStatus("Creating your voice clone...");

    try {
      const formData = new FormData();
      formData.append("voice", voiceFile);
      formData.append("name", "My Voice Clone");

      const response = await fetch(
        "http://localhost:5000/api/clone-voice",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Voice cloning failed.");
      }

      setVoiceId(data.voiceId);
      setStatus("Voice clone created successfully!");
    } catch (error) {
      console.error("Clone error:", error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const generateSpeech = async () => {
    if (!voiceId) {
      setStatus("Please create your voice clone first.");
      return;
    }

    if (!text.trim()) {
      setStatus("Please enter some text.");
      return;
    }

    setStatus("Generating speech...");

    try {
      const response = await fetch(
        "http://localhost:5000/api/generate-speech",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            voiceId,
            text,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || "Speech generation failed."
        );
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);

      setAudioUrl(url);
      setStatus("Speech generated successfully!");
    } catch (error) {
      console.error("Speech error:", error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setVoiceFile(file);
    setVoiceId("");
    setAudioUrl("");
    setStatus(`Selected: ${file.name}`);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">🎙️ Voice Clone Studio</div>
        <div className="header-badge">AI Voice Technology</div>
      </header>

      <section className="hero">
        <div className="hero-badge">
          ✦ AI VOICE TECHNOLOGY
        </div>

        <h1>
          Give AI
          <br />
          <span>Your Voice.</span>
        </h1>

        <p>
          Create a digital version of your voice and turn
          any text into natural-sounding speech.
        </p>
      </section>

      <main className="main">
        <section className="card">
          <div className="card-number">01</div>

          <div className="card-content">
            <h2>Create Your Voice Clone</h2>

            <p>
              Upload a clear voice recording to create
              your AI voice.
            </p>

            <label className="upload-box">
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a"
                onChange={handleFileChange}
              />

              <div className="upload-icon">🎤</div>

              <strong>
                {voiceFile
                  ? voiceFile.name
                  : "Choose a voice recording"}
              </strong>

              <span>
                MP3, WAV, M4A or other audio formats
              </span>
            </label>

            <button
              className="primary-button"
              onClick={cloneVoice}
              disabled={!voiceFile}
            >
              {voiceId
                ? "Voice Clone Created ✓"
                : "Create Voice Clone →"}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-number">02</div>

          <div className="card-content">
            <h2>Generate Speech</h2>

            <p>
              Type anything and hear it in your cloned voice.
            </p>

            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type something..."
            />

            <button
              className="primary-button"
              onClick={generateSpeech}
              disabled={!voiceId}
            >
              🔊 Generate Speech
            </button>

            {audioUrl && (
              <div className="audio-player">
                <p>Generated Voice</p>

                <audio
                  controls
                  src={audioUrl}
                />
              </div>
            )}
          </div>
        </section>

        {status && (
          <div className="status-message">
            {status}
          </div>
        )}
      </main>

      <section className="capabilities">
        <h2>What can a voice clone do?</h2>

        <div className="capability-grid">
          <div className="capability">
            <span>01</span>
            <h3>Text → Voice</h3>
            <p>
              Convert written text into natural speech.
            </p>
          </div>

          <div className="capability">
            <span>02</span>
            <h3>AI Voice Assistant</h3>
            <p>
              Build conversational AI that speaks naturally.
            </p>
          </div>

          <div className="capability">
            <span>03</span>
            <h3>Multilingual</h3>
            <p>
              Generate speech across supported languages.
            </p>
          </div>

          <div className="capability">
            <span>04</span>
            <h3>Content Creation</h3>
            <p>
              Create narration for videos and presentations.
            </p>
          </div>

          <div className="capability">
            <span>05</span>
            <h3>Accessibility</h3>
            <p>
              Turn written content into spoken experiences.
            </p>
          </div>

          <div className="capability">
            <span>06</span>
            <h3>Voice Agents</h3>
            <p>
              Build applications that communicate using voice.
            </p>
          </div>
        </div>
      </section>

      <section className="architecture">
        <h2>How it works</h2>

        <div className="pipeline">
          <div>
            🎤
            <span>Voice Sample</span>
          </div>

          <b>→</b>

          <div>
            🧠
            <span>Voice Model</span>
          </div>

          <b>→</b>

          <div>
            🤖
            <span>AI Brain</span>
          </div>

          <b>→</b>

          <div>
            🔊
            <span>Generated Speech</span>
          </div>
        </div>
      </section>

      <footer>
        Voice Clone Studio · AI Voice Demonstration
      </footer>
    </div>
  );
}

export default App;