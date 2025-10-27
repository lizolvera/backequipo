// controllers/userController.js (Ampliado con 2FA, sin quitar tu lógica)
const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");

// === NUEVO: deps para 2FA ===
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

// === NUEVO: store OTP temporal en memoria (en prod: Redis/DB) ===
const otpStore = new Map(); // tempToken -> { email, codigo, expira, intentos }

// === NUEVO: helpers 2FA ===
const genCodigo = () => String(Math.floor(100000 + Math.random() * 900000));
const maskEmail = (correo = "") => correo.replace(/(.{2}).+(@.+)/, "$1***$2");

// Lee SMTP desde variables de entorno (.env)
async function getTransporter() {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
  } = process.env;

  // Transporter básico con SMTP real (Gmail/SendGrid/Mailgun/Office365)
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT || 465),
    secure: (EMAIL_SECURE === "true"),
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  // (opcional) verifica credenciales al levantar
  // await transporter.verify();

  return transporter;
}

async function enviarCodigoEmail({ to, codigo }) {
  const t = await getTransporter();
  await t.sendMail({
    from: `"Registro" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Código de verificación",
    text: `Tu código es: ${codigo}. Expira en 5 minutos.`,
    html: `
      <div style="font-family:system-ui;padding:16px">
        <h2>Verificación de cuenta</h2>
        <p>Tu código:</p>
        <div style="font-size:22px;font-weight:700;letter-spacing:3px">${codigo}</div>
        <p style="color:#666">Válido por 5 minutos.</p>
      </div>
    `,
  });
}

// ====================
// Registrar un nuevo usuario (tu función original + 2FA)
// ====================
const registerUser = async (req, res) => {
  try {
    const { username, email, telefono } = req.body;

    // Verificar si el nombre de usuario ya existe
    const existingUsername = await Usuario.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "El nombre de usuario ya está en uso" });
    }

    // Verificar si el correo electrónico ya existe
    const existingEmail = await Usuario.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "El correo electrónico ya está registrado" });
    }

    // Verificar si el número de teléfono ya existe
    const existingTelefono = await Usuario.findOne({ telefono });
    if (existingTelefono) {
      return res.status(400).json({ error: "El número de teléfono ya está registrado" });
    }

    const { nombre, ap, am, password, preguntaSecreta, respuestaSecreta } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = new Usuario({
      nombre,
      ap,
      am,
      username,
      email,
      password: hashedPassword,
      telefono,
      preguntaSecreta,
      respuestaSecreta,
      // SUGERENCIA: si tu modelo tiene este campo, mejor marcarlo
      // verificado: false,
    });

    await nuevoUsuario.save();

    // === NUEVO: 2FA por correo ===
    // Genera tempToken + código, guarda en store y envía por email
    const tempToken = uuidv4();
    const codigo = genCodigo();
    otpStore.set(tempToken, {
      email,
      codigo,
      expira: Date.now() + 5 * 60 * 1000, // 5 minutos
      intentos: 0,
    });

    await enviarCodigoEmail({ to: email, codigo });

    // RESPUESTA: conservamos tu mensaje y usuario,
    // y añadimos los campos del 2FA para el frontend
    return res.status(201).json({
      mensaje: "Usuario registrado con éxito",
      usuario: nuevoUsuario,
      requires2fa: true,
      canal: "email",
      destino: maskEmail(email),
      tempToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

// ====================
// NUEVO: Verificar código 2FA
// body: { tempToken, codigo }
// res: { ok: true }
// ====================
const verificarRegistro2FA = async (req, res) => {
  try {
    const { tempToken, codigo } = req.body || {};
    const data = otpStore.get(tempToken);
    if (!data) {
      return res.status(400).json({ error: "Sesión 2FA inválida" });
    }

    // Expirado
    if (Date.now() > data.expira) {
      otpStore.delete(tempToken);
      return res.status(400).json({ error: "Código expirado" });
    }

    // Incorrecto
    if (String(codigo) !== String(data.codigo)) {
      data.intentos = (data.intentos || 0) + 1;
      if (data.intentos >= 5) {
        otpStore.delete(tempToken);
        return res.status(429).json({ error: "Demasiados intentos" });
      }
      return res.status(400).json({ error: "Código incorrecto" });
    }

    // Opcional: marcar usuario como verificado si tu modelo lo soporta
    // await Usuario.updateOne({ email: data.email }, { $set: { verificado: true } });

    otpStore.delete(tempToken);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al verificar código" });
  }
};

// ====================
// NUEVO: Reenviar código 2FA
// body: { tempToken }
// res: { ok: true, canal, destino }
// ====================
const reenviarRegistro2FA = async (req, res) => {
  try {
    const { tempToken } = req.body || {};
    const data = otpStore.get(tempToken);
    if (!data) {
      return res.status(400).json({ error: "Sesión 2FA inválida" });
    }

    const nuevo = genCodigo();
    otpStore.set(tempToken, {
      email: data.email,
      codigo: nuevo,
      expira: Date.now() + 5 * 60 * 1000,
      intentos: 0,
    });

    await enviarCodigoEmail({ to: data.email, codigo: nuevo });

    return res.json({
      ok: true,
      canal: "email",
      destino: maskEmail(data.email),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al reenviar código" });
  }
};

// Exporta tu función original + nuevas 2FA
module.exports = {
  registerUser,
  verificarRegistro2FA,
  reenviarRegistro2FA,
};
