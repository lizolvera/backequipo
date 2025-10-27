// controllers/userController.js (FLUJO CORREGIDO)
const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");

// === Dependencies para 2FA ===
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

// === Store temporal para datos de registro pendientes ===
const pendingRegistrations = new Map(); // tempToken -> { datosUsuario, codigo, expira, intentos }

// === Helpers 2FA ===
const genCodigo = () => String(Math.floor(100000 + Math.random() * 900000));
const maskEmail = (correo = "") => correo.replace(/(.{2}).+(@.+)/, "$1***$2");

// Configuración de email
async function getTransporter() {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
  } = process.env;

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT || 465),
    secure: (EMAIL_SECURE === "true"),
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

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
// INICIAR REGISTRO (solo validar y enviar código)
// ====================
const registerUser = async (req, res) => {
  try {
    console.log("Solicitud de registro recibida:", req.body);
    
    // Mapeo: Campos del frontend → Modelo
    const {
      nombre,
      apellidopaterno,
      apellidomaterno,
      correo,
      contrasena,
      telefono,
      preguntasecreta,
      respuestasecreta
    } = req.body;

    // Validación de campos requeridos
    if (!nombre || !apellidopaterno || !apellidomaterno || !correo || !contrasena || !telefono || !preguntasecreta || !respuestasecreta) {
      return res.status(400).json({ 
        error: "Todos los campos son obligatorios" 
      });
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      return res.status(400).json({ 
        error: "Formato de correo electrónico inválido" 
      });
    }

    // Validación de contraseña
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d\S]{8,}$/;
    if (!passRegex.test(contrasena)) {
      return res.status(400).json({ 
        error: "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número" 
      });
    }

    // Verificar si el correo ya existe EN LA BASE DE DATOS (usuarios ya registrados)
    const existingEmail = await Usuario.findOne({ email: correo });
    if (existingEmail) {
      return res.status(400).json({ 
        error: "El correo electrónico ya está registrado" 
      });
    }

    // Verificar si el teléfono ya existe
    const existingTelefono = await Usuario.findOne({ telefono });
    if (existingTelefono) {
      return res.status(400).json({ 
        error: "El número de teléfono ya está registrado" 
      });
    }

    // === IMPORTANTE: NO guardar en BD todavía ===
    // Solo preparar datos y enviar código de verificación

    // Preparar datos del usuario (sin guardar)
    const userData = {
      nombre: nombre,
      ap: apellidopaterno,
      am: apellidomaterno,
      username: correo, // Usar email como username
      email: correo,
      password: contrasena, // Guardar temporalmente sin hashear
      telefono: telefono,
      preguntaSecreta: preguntasecreta,
      respuestaSecreta: respuestasecreta, // Guardar temporalmente sin hashear
      rol: "usuario"
    };

    // Generar token temporal y código
    const tempToken = uuidv4();
    const codigo = genCodigo();

    // Guardar en store temporal (NO en BD)
    pendingRegistrations.set(tempToken, {
      userData: userData,
      codigo: codigo,
      expira: Date.now() + 5 * 60 * 1000, // 5 minutos
      intentos: 0,
    });

    console.log(`Enviando código 2FA a: ${correo}`);
    await enviarCodigoEmail({ to: correo, codigo: codigo });

    // Respuesta al frontend - SOLO código enviado
    return res.status(200).json({
      success: true,
      mensaje: "Código de verificación enviado. Revisa tu correo electrónico.",
      requires2fa: true,
      canal: "email",
      destino: maskEmail(correo),
      tempToken: tempToken,
    });

  } catch (error) {
    console.error("Error en solicitud de registro:", error);
    
    res.status(500).json({ 
      error: "Error interno del servidor: " + error.message 
    });
  }
};

// ====================
// VERIFICAR CÓDIGO 2FA Y REGISTRAR USUARIO
// ====================
const verificarRegistro2FA = async (req, res) => {
  try {
    const { tempToken, codigo } = req.body || {};
    
    if (!tempToken || !codigo) {
      return res.status(400).json({ 
        error: "Token y código son requeridos" 
      });
    }

    const pendingData = pendingRegistrations.get(tempToken);
    if (!pendingData) {
      return res.status(400).json({ 
        error: "Sesión de verificación inválida o expirada" 
      });
    }

    // Verificar expiración
    if (Date.now() > pendingData.expira) {
      pendingRegistrations.delete(tempToken);
      return res.status(400).json({ 
        error: "Código expirado. Solicite uno nuevo." 
      });
    }

    // Verificar código
    if (String(codigo) !== String(pendingData.codigo)) {
      pendingData.intentos = (pendingData.intentos || 0) + 1;
      
      if (pendingData.intentos >= 5) {
        pendingRegistrations.delete(tempToken);
        return res.status(429).json({ 
          error: "Demasiados intentos fallidos. Registro cancelado." 
        });
      }
      
      return res.status(400).json({ 
        error: `Código incorrecto. Intentos restantes: ${5 - pendingData.intentos}` 
      });
    }

    // ✅ CÓDIGO CORRECTO - AHORA SÍ REGISTRAR EN BD
    console.log("Código verificado. Registrando usuario en BD...");

    const userData = pendingData.userData;

    // Hashear contraseña ANTES de guardar
    const hashedPassword = await new Promise((resolve, reject) => {
      bcrypt.hash(userData.password, 10, (err, hash) => {
        if (err) {
          reject(new Error("Error al procesar la contraseña"));
        } else {
          resolve(hash);
        }
      });
    });

    // Hashear respuesta secreta
    const hashedRespuesta = await new Promise((resolve, reject) => {
      bcrypt.hash(userData.respuestaSecreta, 10, (err, hash) => {
        if (err) {
          reject(new Error("Error al procesar la respuesta secreta"));
        } else {
          resolve(hash);
        }
      });
    });

    // Crear usuario con datos hasheados
    const nuevoUsuario = new Usuario({
      ...userData,
      password: hashedPassword,
      respuestaSecreta: hashedRespuesta,
      verificado: true, // ← Marcado como verificado
    });

    // FINALMENTE guardar en base de datos
    await nuevoUsuario.save();
    console.log(`Usuario ${userData.email} registrado exitosamente`);

    // Limpiar datos temporales
    pendingRegistrations.delete(tempToken);

    // Respuesta de éxito
    return res.json({ 
      success: true,
      mensaje: "¡Registro completado exitosamente! Tu cuenta ha sido verificada y creada.",
      usuario: {
        id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        verificado: nuevoUsuario.verificado
      }
    });

  } catch (error) {
    console.error("Error en verificación 2FA:", error);
    
    // Manejar errores de duplicados (por si acaso)
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: "El usuario ya fue registrado recientemente" 
      });
    }

    res.status(500).json({ 
      error: "Error interno al completar el registro: " + error.message 
    });
  }
};

// ====================
// REENVIAR CÓDIGO 2FA
// ====================
const reenviarRegistro2FA = async (req, res) => {
  try {
    const { tempToken } = req.body || {};
    
    if (!tempToken) {
      return res.status(400).json({ 
        error: "Token requerido" 
      });
    }

    const pendingData = pendingRegistrations.get(tempToken);
    if (!pendingData) {
      return res.status(400).json({ 
        error: "Sesión de registro inválida" 
      });
    }

    // Generar nuevo código
    const nuevoCodigo = genCodigo();
    const userEmail = pendingData.userData.email;
    
    // Actualizar store temporal
    pendingRegistrations.set(tempToken, {
      ...pendingData,
      codigo: nuevoCodigo,
      expira: Date.now() + 5 * 60 * 1000, // Renovar 5 minutos
      intentos: 0, // Resetear intentos
    });

    console.log(`Reenviando código 2FA a: ${userEmail}`);
    await enviarCodigoEmail({ to: userEmail, codigo: nuevoCodigo });

    return res.json({
      success: true,
      mensaje: "Código reenviado exitosamente",
      canal: "email",
      destino: maskEmail(userEmail),
    });

  } catch (err) {
    console.error("Error al reenviar código 2FA:", err);
    res.status(500).json({ 
      error: "Error interno al reenviar código" 
    });
  }
};

// ====================
// LIMPIAR REGISTROS PENDIENTES EXPIRADOS (opcional)
// ====================
const limpiarRegistrosExpirados = () => {
  const now = Date.now();
  for (const [token, data] of pendingRegistrations.entries()) {
    if (now > data.expira) {
      pendingRegistrations.delete(token);
      console.log(`Registro pendiente expirado eliminado: ${token}`);
    }
  }
};

// Ejecutar limpieza cada hora
setInterval(limpiarRegistrosExpirados, 60 * 60 * 1000);

module.exports = {
  registerUser,
  verificarRegistro2FA,
  reenviarRegistro2FA,
};