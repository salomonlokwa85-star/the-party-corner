// Formulier The Party Corner -> e-mail via Resend
// Vereist environment variable RESEND_API_KEY in Vercel.

const TO = "gladys.commuagency@gmail.com";
const FROM = "The Party Corner <noreply@thepartycorner.be>";

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function line(label, value) {
  if (!value) return "";
  return `<tr><td style="padding:6px 14px 6px 0;color:#5b5a63;white-space:nowrap">${esc(label)}</td>` +
         `<td style="padding:6px 0;color:#2a2a33"><strong>${esc(value)}</strong></td></tr>`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  }
  body = body || {};

  // Honeypot: bots vullen dit verborgen veld in, mensen niet.
  if (body.website) return res.status(200).json({ ok: true });

  const nom = String(body.nom || "").trim();
  const email = String(body.email || "").trim();
  const telephone = String(body.telephone || "").trim();
  const date = String(body.date || "").trim();
  const formule = String(body.formule || "").trim();
  const theme = String(body.theme || "").trim();
  const message = String(body.message || "").trim();

  if (!nom || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Nom et adresse e-mail valides requis." });
  }
  if (nom.length > 120 || email.length > 160 || message.length > 4000) {
    return res.status(400).json({ error: "Contenu trop long." });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY ontbreekt");
    return res.status(500).json({ error: "Configuration manquante." });
  }

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
      <h2 style="color:#123f3f;margin:0 0 4px">Nouvelle demande de réservation</h2>
      <p style="color:#5b5a63;margin:0 0 18px">Envoyée via thepartycorner.be</p>
      <table style="border-collapse:collapse;font-size:15px">
        ${line("Nom", nom)}
        ${line("E-mail", email)}
        ${line("Téléphone", telephone)}
        ${line("Date souhaitée", date)}
        ${line("Formule", formule)}
        ${line("Thème / Pack", theme)}
      </table>
      ${message ? `<p style="margin:18px 0 6px;color:#5b5a63">Message :</p>
      <div style="white-space:pre-wrap;background:#fbf5ea;border-radius:10px;padding:14px;color:#2a2a33">${esc(message)}</div>` : ""}
      <p style="margin-top:22px;font-size:13px;color:#5b5a63">Répondez simplement à cet e-mail pour contacter le client.</p>
    </div>`;

  const text = [
    "Nouvelle demande de réservation (thepartycorner.be)",
    `Nom: ${nom}`,
    `E-mail: ${email}`,
    telephone ? `Téléphone: ${telephone}` : "",
    date ? `Date souhaitée: ${date}` : "",
    formule ? `Formule: ${formule}` : "",
    theme ? `Thème / Pack: ${theme}` : "",
    message ? `\nMessage:\n${message}` : ""
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Nouvelle demande — ${nom}${date ? " — " + date : ""}`,
        html,
        text
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend error", response.status, detail);
      return res.status(502).json({ error: "Envoi impossible pour le moment." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Resend request failed", err);
    return res.status(502).json({ error: "Envoi impossible pour le moment." });
  }
};
