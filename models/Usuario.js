const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ap: { type: String, required: true },
  am: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telefono: { type: String, required: true },
  preguntaSecreta: { type: String, required: true },
  respuestaSecreta: { type: String, required: true },
  rol: { type: String, enum: ["usuario", "admin"], default: "usuario" },
});

usuarioSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

usuarioSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  },
});

const Usuario = mongoose.model("Usuario", usuarioSchema);

module.exports = Usuario;