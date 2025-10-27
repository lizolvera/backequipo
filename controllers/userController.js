// controllers/userController.js (Simplificado)
const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");
// No se necesita JWT para registrar

// Registrar un nuevo usuario
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
    });

    await nuevoUsuario.save();
    res.status(201).json({ mensaje: "Usuario registrado con éxito", usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

// Exporta solo la función que necesitas
module.exports = { registerUser };