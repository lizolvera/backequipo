const express = require("express");
const cors = require("cors");
const conectarDB = require("./config/db");
require("dotenv").config();
const morgan =require("morgan")
// Importar las rutas
const userRoutes = require("./routes/userRoutes");

const app = express();
const port = process.env.PORT || 4000;

// ===== AGREGADO: configurar origen permitido desde .env =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

// Middleware para parsear JSON y habilitar CORS
app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(morgan("dev"));

// Conectar a la base de datos
conectarDB();

// ===== AGREGADO: ruta de salud/diagnóstico =====
app.get("/", (_req, res) => {
  res.send("API OK");
});
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "¡Hola Mundo! ",
    description: "API funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});
// Rutas API existentes
app.use("/api/usuarios", userRoutes);

// Iniciar servidor
app.listen(port, () => {
  // ===== CORREGIDO: usar template literal para ver el puerto correctamente =====
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
