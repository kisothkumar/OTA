import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const db = getFirestore(app);

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("bulkFile");
  const status = document.getElementById("uploadStatus");
  const file = fileInput.files[0];

  if (!file) {
    status.textContent = "Please choose a file first.";
    return;
  }

  status.textContent = "Reading file...";
  let rawText = "";

  if (file.name.endsWith(".txt")) {
    rawText = await file.text();
  } else if (file.name.endsWith(".docx")) {
    // Requires mammoth.js loaded via CDN in teacher.html
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    rawText = result.value;
  } else {
    status.textContent = "Old .doc format isn't readable in-browser. Please save as .docx or .txt.";
    return;
  }

  const parsed = parseQuestions(rawText);

  if (!parsed.subject || parsed.questions.length === 0) {
    status.textContent = "Couldn't find subject or questions. Check the file format.";
    return;
  }

  status.textContent = `Uploading ${parsed.questions.length} questions to "${parsed.subject}"...`;

  for (const q of parsed.questions) {
    await addDoc(collection(db, "questions", parsed.subject, "items"), q);
  }

  status.textContent = `✅ Uploaded ${parsed.questions.length} questions to ${parsed.subject}.`;
  fileInput.value = "";
});

function parseQuestions(text) {
  const subjectMatch = text.match(/Subject:\s*(.+)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : null;

  const blocks = text.split(/\n\s*Q\d+\.\s*/).slice(1); // splits on "Q1.", "Q2." etc
  const questions = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;

    const question = lines[0];
    const options = [];
    let answer = "";
    let marks = 1;

    for (const line of lines.slice(1)) {
      const optMatch = line.match(/^[A-D]\)\s*(.+)/i);
      const ansMatch = line.match(/^Answer:\s*([A-D])/i);
      const marksMatch = line.match(/^Marks:\s*(\d+)/i);

      if (optMatch) options.push(optMatch[1].trim());
      else if (ansMatch) answer = options[ansMatch[1].toUpperCase().charCodeAt(0) - 65] || ansMatch[1];
      else if (marksMatch) marks = parseInt(marksMatch[1]);
    }

    questions.push({ question, options, answer, marks });
  }

  return { subject, questions };
}
