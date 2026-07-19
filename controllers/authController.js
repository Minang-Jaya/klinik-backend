const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ================= REGISTER =================
exports.register = async (req, res) => {
  const { nama, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql =
      "INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)";

    db.query(sql, [nama, email, hashedPassword, role], (err, result) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }

      res.json({
        message: "User berhasil dibuat",
      });
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= LOGIN =================
exports.login = (req, res) => {
  const email = req.body.email?.trim();
  const password = req.body.password?.trim();

  // Validasi input
  if (!email || !password) {
    return res.status(400).json({
      message: "Email dan password wajib diisi",
    });
  }

  const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

  db.query(sql, [email], async (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    // User tidak ditemukan
    if (results.length === 0) {
      return res.status(401).json({
        message: "User tidak ditemukan",
      });
    }

    const user = results[0];

    // DEBUG CONSOLE
    console.log("========== LOGIN DEBUG ==========");
    console.log("BODY:", req.body);
    console.log("EMAIL:", email);
    console.log("PASSWORD INPUT:", password);
    console.log("HASH DB:", user.password);

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    console.log("MATCH:", isMatch);
    console.log("=================================");

    // Password salah
    if (!isMatch) {
      return res.status(401).json({
        message: "Password salah",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    // Success login
    res.json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        nama: user.nama,
        role: user.role,
      },
    });
  });
};

// ================= GET PROFILE LOGIN =================
exports.getProfile = (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // TOKEN TIDAK ADA
    if (!authHeader) {
      return res.status(401).json({
        message: "Token tidak ditemukan",
      });
    }

    // AMBIL TOKEN
    const token = authHeader.split(" ")[1];

    // VERIFY JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // QUERY USER
    const sql = `
      SELECT
        id,
        nama,
        nik,
        divisi,
        email,
        no_hp,
        alamat,
        kelurahan,
        kecamatan,
        kota,
        provinsi,
        rt,
        rw,
        role
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    db.query(sql, [decoded.id], (err, results) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }

      // USER TIDAK DITEMUKAN
      if (results.length === 0) {
        return res.status(404).json({
          message: "User tidak ditemukan",
        });
      }

      // SUCCESS
      res.json(results[0]);
    });
  } catch (err) {
    console.log("ERROR GET PROFILE:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
};
// ================= SAVE FCM TOKEN =================
exports.saveFcmToken = (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token tidak ditemukan",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        message: "FCM Token wajib diisi",
      });
    }

    const sql = "UPDATE users SET fcm_token = ? WHERE id = ?";

    db.query(sql, [fcm_token, decoded.id], (err) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }

      res.json({
        message: "FCM Token berhasil disimpan",
      });
    });
  } catch (err) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};
