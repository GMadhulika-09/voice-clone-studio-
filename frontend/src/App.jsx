import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const API_URL = "http://localhost:8000";
const SUPPORTED_LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Chinese", label: "Chinese (Mandarin)" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
  { value: "German", label: "German" },
  { value: "French", label: "French" },
  { value: "Russian", label: "Russian" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Spanish", label: "Spanish" },
  { value: "Italian", label: "Italian" },
  // Hindi and Telugu are intentionally not selectable with the current Qwen checkpoint.
];
const photos = {
  hero: "https://images.pexels.com/photos/7598559/pexels-photo-7598559.jpeg?cs=srgb",
  professional: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1000&q=85",
  instant: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1000&q=85",
};
const useCases = [
  { number: "01", title: "Creators", description: "Create narration, videos, podcasts and content without recording every line." },
  { number: "02", title: "Businesses", description: "Create product videos, training content, presentations and internal communication." },
  { number: "03", title: "Teams", description: "Keep reusable voices and generated speech inside one focused workspace." },
];
const faqs = [
  { question: "How does voice cloning work?", answer: "Upload a suitable recording of a voice you own or have permission to use. The backend prepares it as a reference for generating speech from your text." },
  { question: "What files can I upload?", answer: "Common audio and video formats are accepted when FFmpeg can decode them. Very large, damaged or unsupported files may fail." },
  { question: "Can I save multiple voices?", answer: "Yes. Your account can store multiple voice references in the Supabase Voice Library." },
  { question: "Can I use generated audio commercially?", answer: "Only use voices you own or have permission to clone. Commercial use also depends on the applicable rights and terms." },
  { question: "Are the paid plans available?", answer: "The prices displayed here are examples only. Payments, subscriptions and plan limits are not enabled." },
];

async function readApiResponse(response, fallback) {
  if (response.ok) return response;
  let message = fallback;
  try {
    const data = await response.json();
    message = data.detail || data.message || fallback;
  } catch { /* response wasn't JSON */ }
  throw new Error(message);
}

function ThemeToggle({ theme, onToggle }) {
  return <button type="button" className="theme-toggle" onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>{theme === "dark" ? "Light mode" : "Dark mode"}</button>;
}

function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault(); setError(""); setMessage("");
    if (mode !== "reset" && !password) return setError("Please enter your password.");
    if (mode === "signup" && !name.trim()) return setError("Please enter your name.");
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (resetError) throw resetError;
        setMessage("If password recovery is enabled, you will receive an email with the next steps.");
      } else if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/` } });
        if (signupError) throw signupError;
        if (data.session) onSuccess(data.session);
        else { setMode("login"); setPassword(""); setMessage("Account created. Check your email if verification is required, then sign in."); }
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
        onSuccess(data.session);
      }
    } catch (err) { setError(err.message || "Authentication failed."); }
    finally { setLoading(false); }
  }
  function changeMode(next) { setMode(next); setError(""); setMessage(""); setPassword(""); }
  return <div className="modal-overlay" onClick={onClose}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-heading" onClick={(e) => e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">×</button><div className="modal-label">VOICE CLONE / ACCOUNT</div>
    <h2 id="auth-heading">{mode === "login" ? "Welcome back." : mode === "signup" ? "Create your account." : "Reset your password."}</h2>
    <p className="modal-description">{mode === "login" ? "Sign in to access your voice workspace." : mode === "signup" ? "Create an account to access the studio." : "Enter your account email to request a recovery link."}</p>
    {error && <div className="message error-message" role="alert">{error}</div>}{message && <div className="message success-message" role="status">{message}</div>}
    <form onSubmit={handleSubmit}>{mode === "signup" && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" required /></label>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
      {mode !== "reset" && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Enter your password" required /></label>}
      <button type="submit" className="primary-button full-width" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send recovery email"}</button>
    </form><div className="auth-switch">{mode === "login" && <><button type="button" onClick={() => changeMode("reset")}>Forgot password?</button><p>Don't have an account? <button type="button" onClick={() => changeMode("signup")}>Create one</button></p></>}{mode === "signup" && <>Already have an account? <button type="button" onClick={() => changeMode("login")}>Sign in</button></>}{mode === "reset" && <button type="button" onClick={() => changeMode("login")}>Back to sign in</button>}</div>
  </section></div>;
}

function AddVoiceModal({ onClose, onAdded }) {
  const [file, setFile] = useState(null); const [name, setName] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function handleUpload(event) {
    event.preventDefault(); setError("");
    if (!file) return setError("Please select a recording.");
    if (!name.trim()) return setError("Please give your voice a name.");
    setLoading(true);
    try {
      const formData = new FormData(); formData.append("voice", file);
      const response = await fetch(`${API_URL}/upload-voice`, { method: "POST", body: formData });
      await readApiResponse(response, "Voice upload failed.");
      const result = await response.json();
      if (!result.voice_id || !result.file_path || !result.transcript?.trim()) throw new Error("Backend returned an incomplete voice reference. Check the Python terminal.");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");
      const { data, error: dbError } = await supabase.from("voices").insert({ user_id: user.id, name: name.trim(), original_filename: file.name, transcript: result.transcript, file_path: result.file_path }).select().single();
      if (dbError) throw dbError;
      onAdded({ ...data, backend_voice_id: result.voice_id }); onClose();
    } catch (err) { setError(err.message || "Upload failed."); }
    finally { setLoading(false); }
  }
  return <div className="modal-overlay" onClick={onClose}><section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-heading" onClick={(e) => e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">×</button><div className="modal-label">VOICE LIBRARY / NEW VOICE</div><h2 id="upload-heading">Add a voice.</h2><p className="modal-description">Upload a recording you own or have permission to use.</p>
    {error && <div className="message error-message" role="alert">{error}</div>}<form onSubmit={handleUpload}><label>Voice name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Voice" required /></label>
      <label className="upload-box"><input type="file" accept="audio/*,video/*,.opus,.amr,.wma,.mkv,.mov" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }} required /><span className="upload-icon">↑</span><strong>{file ? file.name : "Choose a recording"}</strong><small>WAV, MP3, M4A, MP4, FLAC, OGG, OPUS and more</small></label>
      <button type="submit" className="primary-button full-width" disabled={loading}>{loading ? "Uploading and analyzing..." : "Upload voice"}</button>
    </form></section></div>;
}

function Dashboard({ session, onLogout, theme, onToggleTheme }) {
  const [page, setPage] = useState("studio"); const [voices, setVoices] = useState([]); const [history, setHistory] = useState([]); const [selectedVoice, setSelectedVoice] = useState(null);
  const [text, setText] = useState("Hello! This is my AI voice clone. Welcome to Voice Clone Studio."); const [language, setLanguage] = useState("English"); const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(true); const [generating, setGenerating] = useState(false); const [error, setError] = useState(""); const [showAddVoice, setShowAddVoice] = useState(false);

  useEffect(() => { let active = true; (async () => {
    setLoading(true); setError("");
    try {
      const { data: voiceData, error: voiceError } = await supabase.from("voices").select("*").order("created_at", { ascending: false });
      if (voiceError) throw voiceError;
      const { data: historyData, error: historyError } = await supabase.from("generations").select("*").order("created_at", { ascending: false });
      if (historyError) throw historyError;
      if (active) { setVoices(voiceData || []); setHistory(historyData || []); setSelectedVoice(voiceData?.[0] || null); }
    } catch (err) { if (active) setError(err.message || "Could not load your workspace."); }
    finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, []);

  function handleAddedVoice(voice) { setVoices((current) => [voice, ...current]); setSelectedVoice(voice); setAudioUrl(""); setPage("studio"); }

  async function activateOrRecoverVoice(initialVoice) {
    let voice = initialVoice;
    if (voice.backend_voice_id) return voice;
    // First attempt: use the persisted absolute path if it still exists on this computer.
    if (voice.file_path && voice.transcript?.trim()) {
      try {
        const response = await fetch(`${API_URL}/activate-voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_path: voice.file_path, transcript: voice.transcript, original_filename: voice.original_filename || "saved-voice.wav" }) });
        await readApiResponse(response, "Could not activate the saved voice.");
        const result = await response.json();
        if (result.voice_id) return { ...voice, backend_voice_id: result.voice_id };
      } catch (activationError) {
        // A stale file path is expected for older records; continue to recording recovery.
        console.warn("Saved path activation failed; trying recovery:", activationError.message);
      }
    }
    if (!voice.transcript?.trim()) throw new Error("This saved voice has no transcript, so the backend cannot search for its recording. Upload the recording again.");
    const recoveryResponse = await fetch(`${API_URL}/recover-voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_path: "", transcript: voice.transcript, original_filename: voice.original_filename || "saved-voice.wav" }) });
    await readApiResponse(recoveryResponse, "Could not search for the saved recording.");
    const recovery = await recoveryResponse.json();
    const matches = recovery.matches || [];
    if (!matches.length || matches[0].score < 0.75) throw new Error("No sufficiently similar recording was found in the backend voice folder. Upload the original recording again.");
    // A transcript match cannot prove speaker identity. If the top matches are tied, stop instead of choosing the wrong speaker.
    if (matches.length > 1 && matches[0].score - matches[1].score < 0.015 && matches[0].filename !== matches[1].filename) {
      throw new Error(`More than one recording matches this transcript (${matches.slice(0, 2).map((m) => m.filename).join(" and ")}). To avoid selecting the wrong speaker, upload the intended recording again.`);
    }
    const best = matches[0];
    const activationResponse = await fetch(`${API_URL}/activate-voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_path: best.file_path, transcript: voice.transcript, original_filename: voice.original_filename || best.filename }) });
    await readApiResponse(activationResponse, "The recovered recording could not be activated.");
    const activation = await activationResponse.json();
    if (!activation.voice_id) throw new Error("The recovered recording did not return a backend voice ID.");
    const updatedVoice = { ...voice, file_path: best.file_path, backend_voice_id: activation.voice_id };
    // Persist the recovered path so future sessions don't need to scan all recordings again.
    const { error: updateError } = await supabase.from("voices").update({ file_path: best.file_path }).eq("id", voice.id);
    if (updateError) console.warn("Recovered path could not be saved to Supabase:", updateError.message);
    return updatedVoice;
  }

  async function generateSpeech() {
    setError("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    if (!selectedVoice) return setError("Please add or select a voice first.");
    if (!text.trim()) return setError("Please enter some text.");
    setGenerating(true);
    try {
      const voice = await activateOrRecoverVoice(selectedVoice);
      setSelectedVoice(voice); setVoices((current) => current.map((item) => item.id === voice.id ? voice : item));
      const response = await fetch(`${API_URL}/clone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_id: voice.backend_voice_id, text: text.trim(), language }) });
      await readApiResponse(response, "Speech generation failed.");
      const newAudioUrl = URL.createObjectURL(await response.blob()); setAudioUrl(newAudioUrl);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user) {
        const { data, error: insertError } = await supabase.from("generations").insert({ user_id: user.id, voice_id: voice.id, text: text.trim() }).select().single();
        if (insertError) setError(`Audio was generated, but saving history failed: ${insertError.message}`);
        else if (data) setHistory((current) => [data, ...current]);
      }
    } catch (err) { setError(err.message || "Speech generation failed."); }
    finally { setGenerating(false); }
  }

  async function deleteVoice(id) {
    if (!window.confirm("Delete this voice from your saved library?")) return;
    setError("");
    try {
      const { error: deleteError } = await supabase.from("voices").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setVoices((current) => current.filter((voice) => voice.id !== id));
      if (selectedVoice?.id === id) { setSelectedVoice(null); setAudioUrl(""); }
    } catch (err) { setError(err.message || "Could not delete this voice."); }
  }
  async function logout() { const { error: logoutError } = await supabase.auth.signOut(); if (logoutError) return setError(logoutError.message); onLogout(); }

  return <div className="dashboard"><aside className="sidebar"><div className="sidebar-brand"><div className="brand-square">V</div><div><strong>VOICE CLONE</strong><small>STUDIO</small></div></div><div className="sidebar-heading">WORKSPACE</div>
    <nav className="sidebar-nav">{[["studio", "01", "Studio"], ["voices", "02", "Voice Library"], ["history", "03", "History"]].map(([id, number, label]) => <button type="button" key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><span>{number}</span>{label}</button>)}</nav>
    <div className="sidebar-bottom"><div className="user-mini"><div>{session?.user?.email?.charAt(0)?.toUpperCase() || "U"}</div><span>{session?.user?.email}</span></div><button type="button" onClick={logout}>Log out</button></div></aside>
    <main className="dashboard-main"><header className="dashboard-header"><div><span>VOICE CLONE / WORKSPACE</span><h1>{page === "studio" ? "Studio" : page === "voices" ? "Voice Library" : "Generation History"}</h1></div><div className="dashboard-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme}/><button type="button" className="primary-button" onClick={() => setShowAddVoice(true)}>+ Add voice</button></div></header>
      {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      {page === "studio" && <section className="studio-layout"><div className="studio-editor"><div className="editor-top"><div><span>CREATE SPEECH</span><h2>Write your script.</h2></div><small>● {generating ? "PROCESSING" : "READY"}</small></div>
        <div className="selected-voice"><div><span>SELECTED VOICE</span><strong>{selectedVoice?.name || "No voice selected"}</strong></div><button type="button" onClick={() => setPage("voices")}>Change</button></div>
        <label className="language-field" htmlFor="speech-language">Speech language<select id="speech-language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={generating}>{SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <p className="language-note">Hindi and Telugu are not supported by the currently loaded Qwen3-TTS 0.6B Base checkpoint.</p>
        <label className="sr-only" htmlFor="speech-script">Speech text</label><textarea id="speech-script" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write what you want your voice to say..."/>
        <div className="editor-bottom"><span>{text.length} characters</span><button type="button" className="primary-button" onClick={generateSpeech} disabled={generating || loading}>{generating ? "Generating..." : "Generate speech →"}</button></div>
        {audioUrl && <div className="generated-result"><span>GENERATED AUDIO</span><strong>Your audio is ready.</strong><audio controls src={audioUrl}>Your browser does not support audio playback.</audio><a href={audioUrl} download="voice-clone-output.wav">Download audio</a></div>}</div>
        <aside className="studio-side"><span>VOICE DETAILS</span>{selectedVoice ? <><div className="voice-symbol">V</div><h3>{selectedVoice.name}</h3><p>{selectedVoice.original_filename || "Voice reference"}</p><div className="detail-line"><span>Reference</span><strong>{selectedVoice.file_path ? "Saved path" : "Recovery needed"}</strong></div><button type="button" className="delete-button" onClick={() => deleteVoice(selectedVoice.id)}>Delete voice</button></> : <><div className="voice-symbol empty">+</div><h3>No voice selected.</h3><p>Add a reference recording to begin.</p><button type="button" className="outline-button" onClick={() => setShowAddVoice(true)}>Add voice</button></>}</aside></section>}
      {page === "voices" && <section className="library-page"><div className="page-intro"><span>VOICE LIBRARY</span><h2>Your voices.</h2><p>Your saved voice references.</p></div>{loading ? <div className="empty-state">Loading your voices...</div> : !voices.length ? <div className="empty-state"><span>NO VOICES</span><h3>Your library is empty.</h3><button type="button" className="primary-button" onClick={() => setShowAddVoice(true)}>Add your first voice</button></div> : <div className="voice-grid">{voices.map((voice) => <article className="voice-card" key={voice.id}><div className="voice-card-header"><span>VOICE REFERENCE</span><button type="button" onClick={() => deleteVoice(voice.id)} aria-label={`Delete ${voice.name}`}>×</button></div><div className="voice-card-symbol">V</div><h3>{voice.name}</h3><p>{voice.original_filename || "Voice reference"}</p><button type="button" onClick={() => { setSelectedVoice(voice); setAudioUrl(""); setPage("studio"); }}>Use this voice →</button></article>)}</div>}</section>}
      {page === "history" && <section className="library-page"><div className="page-intro"><span>GENERATION HISTORY</span><h2>Previous work.</h2><p>Your recently generated scripts.</p></div>{!history.length ? <div className="empty-state"><span>NO GENERATIONS</span><h3>Nothing here yet.</h3><button type="button" className="outline-button" onClick={() => setPage("studio")}>Create your first generation</button></div> : <div className="history-list">{history.map((item, index) => <article className="history-item" key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><p>{item.text}</p><button type="button" onClick={() => { setText(item.text || ""); setAudioUrl(""); setPage("studio"); }}>Reuse text →</button></article>)}</div>}</section>}
    </main>{showAddVoice && <AddVoiceModal onClose={() => setShowAddVoice(false)} onAdded={handleAddedVoice}/>}
  </div>;
}

function LandingPage({ onLogin, theme, onToggleTheme }) {
  const [openFaq, setOpenFaq] = useState(null);
  function scrollToSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  return <div className="landing"><header className="navbar"><button type="button" className="navbar-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Voice Clone Studio home"><span>V</span><strong>VOICE <em>CLONE</em></strong></button>
    <nav className="navbar-links" aria-label="Main navigation">{[["services", "Services"], ["use-cases", "Use Cases"], ["pricing", "Pricing"], ["how-it-works", "How It Works"], ["faq", "FAQ"]].map(([id, label]) => <button type="button" key={id} onClick={() => scrollToSection(id)}>{label}</button>)}</nav><div className="navbar-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme}/><button type="button" className="login-link" onClick={onLogin}>Log in</button><button type="button" className="primary-button" onClick={onLogin}>Get started free</button></div></header>
    <section className="hero"><div className="hero-left"><div className="eyebrow"><span/>AI VOICE GENERATION</div><h1>Your voice.<br/><i>Reimagined.</i></h1><p>Create speech from a voice recording using a connected voice-generation engine. Upload a reference, write your script and generate audio in one workspace.</p><div className="hero-buttons"><button type="button" className="primary-button large" onClick={onLogin}>Start creating <span>↗</span></button><button type="button" className="secondary-link" onClick={() => scrollToSection("how-it-works")}>See how it works ↓</button></div></div><div className="hero-image"><img src={photos.hero} alt="Professional audio recording equipment in a studio" fetchPriority="high"/><div className="hero-image-overlay"><span>RECORDING / REFERENCE</span><strong>Start with your voice.</strong></div></div></section>
    <section className="intro-section"><div className="section-number">01 / INTRODUCTION</div><div className="intro-main"><h2>A simpler way to<br/><i>work with voice.</i></h2></div><p>A focused workspace for turning an authorized voice reference into generated speech. Upload, write and generate without jumping between disconnected tools.</p></section>
    <section className="services-section" id="services"><div className="section-heading"><span>02 / SERVICES</span><h2>Built around<br/><i>your voice.</i></h2></div><div className="service-grid"><article className="service-card dark-card"><div className="service-photo"><img src={photos.professional} alt="Audio recording equipment" loading="lazy"/></div><div className="service-top"><span>01 / PROFESSIONAL</span><span>VOICE WORKFLOW</span></div><h3>Professional<br/>Voice Cloning</h3><p>Create speech for presentations, narration and projects using voice references you have permission to use.</p><button type="button" className="service-arrow" onClick={onLogin}>Open studio →</button></article><article className="service-card light-card"><div className="service-photo"><img src={photos.instant} alt="Podcast recording setup" loading="lazy"/></div><div className="service-top"><span>02 / CREATOR</span><span>TEXT TO SPEECH</span></div><h3>Create<br/>New Speech</h3><p>Prepare a script, select an available reference voice and listen to the generated result.</p><button type="button" className="service-arrow" onClick={onLogin}>Try the studio →</button></article></div></section>
    <section className="usecases-section" id="use-cases"><div className="section-heading"><span>03 / USE CASES</span><h2>Made for<br/><i>real work.</i></h2></div><div className="usecase-list">{useCases.map((item) => <article key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.description}</p><strong aria-hidden="true">↗</strong></article>)}</div></section>
    <section className="how-section" id="how-it-works"><div className="section-heading"><span>04 / HOW IT WORKS</span><h2>Four simple<br/><i>steps.</i></h2></div><div className="steps">{[["01", "Upload", "Choose a suitable recording of a voice you are authorized to use."], ["02", "Analyze", "The backend processes the reference; time depends on your system and recording."], ["03", "Write", "Enter the words you want the selected voice to speak."], ["04", "Generate", "Generate, play or download speech from the connected Qwen3-TTS backend."]].map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
    <section className="pricing-section" id="pricing"><div className="section-heading"><span>05 / PROPOSED PRICING</span><h2>Start simple.<br/><i>Scale later.</i></h2></div><div className="pricing-grid">{[["01", "STARTER", "Free", "₹0", "Try the connected studio and explore its workflow."], ["02", "CREATOR", "Pro", "₹499", "A possible future plan for frequent creators."], ["03", "BUSINESS", "Team", "₹1,499", "A possible future plan for business workflows."]].map(([num, tag, title, price, description], i) => <article className={`pricing-card ${i === 1 ? "featured" : ""}`} key={num}>{i === 1 && <div className="pricing-badge">PROPOSED PLAN</div>}<div className="pricing-card-top"><span>{num}</span><span>{tag}</span></div><h3>{title}</h3><div className="price">{price} <small>/ month</small></div><p>{description}</p><ul><li>✓ Voice library interface</li><li>✓ Voice generation interface</li><li>✓ Personal workspace</li><li>✓ Generation history</li></ul><button type="button" className={`${i === 1 ? "primary-button" : "outline-button"} full-width`} onClick={onLogin}>{i === 0 ? "Create free account" : "Explore the studio"}</button></article>)}</div><p className="pricing-note">Sample pricing only. Payments, subscriptions and plan limits are not enabled.</p></section>
    <section className="faq-section" id="faq"><div className="section-heading"><span>06 / FAQ</span><h2>Good to<br/><i>know.</i></h2></div><div className="faq-list">{faqs.map((item, index) => <article key={item.question} className={openFaq === index ? "faq-open" : ""}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{item.question}</span><strong>{openFaq === index ? "−" : "+"}</strong></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</div></section>
    <section className="final-section"><span>READY WHEN YOU ARE</span><h2>Give your voice<br/><i>another life.</i></h2><button type="button" className="primary-button large" onClick={onLogin}>Enter the studio ↗</button></section><footer className="footer"><div className="footer-main"><div className="footer-brand"><div className="footer-logo">V</div><strong>VOICE <em>CLONE</em></strong></div><p>AI-powered voice generation<br/>built around your workflow.</p></div><div className="footer-bottom"><span>© 2026 Voice Clone Studio</span><span>Use voices with permission.</span></div></footer>
  </div>;
}

function App() {
  const [session, setSession] = useState(null); const [loading, setLoading] = useState(true); const [authOpen, setAuthOpen] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("voice-clone-theme") || "dark"; } catch { return "dark"; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; try { localStorage.setItem("voice-clone-theme", theme); } catch { /* optional browser storage */ } }, [theme]);
  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
  useEffect(() => {
    let mounted = true;
    async function getSession() { try { const { data: { session: currentSession }, error } = await supabase.auth.getSession(); if (error) throw error; if (mounted) setSession(currentSession); } catch (err) { console.error("Could not restore session:", err.message); } finally { if (mounted) setLoading(false); } }
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => { if (mounted) setSession(newSession); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  if (loading) return <div className="loading-screen"><div className="loading-logo">V</div><p>Loading Voice Clone Studio...</p></div>;
  if (session) return <Dashboard session={session} onLogout={() => setSession(null)} theme={theme} onToggleTheme={toggleTheme}/>;
  return <><LandingPage onLogin={() => setAuthOpen(true)} theme={theme} onToggleTheme={toggleTheme}/>{authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={(newSession) => { setSession(newSession); setAuthOpen(false); }}/>}</>;
}

export default App;
