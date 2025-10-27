const jwt = require("jsonwebtoken");

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ error: "Acceso denegado. No hay token proporcionado." });
    }

    try {
      const decoded = jwt.verify(token, "secreto");
      req.user = decoded;

      if (roles.length > 0 && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: "Acceso denegado. No tienes permisos suficientes." });
      }

      next();
    } catch (error) {
      res.status(400).json({ error: "Token inválido." });
    }
  };
};

module.exports = authMiddleware;