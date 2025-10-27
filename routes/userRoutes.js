const express = require("express");
const { registerUser, verificarRegistro2FA, reenviarRegistro2FA } = require("../controllers/userController"); // <-- agregado
const router = express.Router();

router.post("/register", registerUser); // tu ruta original intacta

// --- RUTAS 2FA AGREGADAS ---
router.post("/register/2fa/verificar", verificarRegistro2FA);
router.post("/register/2fa/reenviar", reenviarRegistro2FA);

module.exports = router;
