const express = require("express");
const cors = require("cors");
const conectarDB = require("./config/db");
require("dotenv").config();

// Importar las rutas

const userRoutes = require("./routes/userRoutes");

const app = express();
const port = process.env.PORT || 4000;

// Middleware para parsear JSON y habilitar CORS
app.use(express.json());
app.use(cors());

// Conectar a la base de datos
conectarDB();

// Rutas API existentes
app.use("/api/usuarios", userRoutes);

// Iniciar servidor
app.listen(port, () => {
  console.log("🚀 Servidor corriendo en http://localhost:${port}");
});