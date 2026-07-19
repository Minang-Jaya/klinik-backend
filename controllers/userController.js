const bcrypt = require("bcryptjs");
const db = require("../config/db");

// ================= CREATE USER BY RESEPSIONIS =================
exports.createUser = async (req, res) => {
  const {
    nama,
    nik,
    divisi,
    spesialisasi,
    email,
    no_hp,
    alamat,
    kelurahan,
    kecamatan,
    kota,
    provinsi,
    rt,
    rw,
    password,
    role,
  } = req.body;

  // ================= VALIDASI FIELD =================
  if (!nama || !nik || !email || !no_hp || !password || !role) {
    return res.status(400).json({
      message: "Semua field wajib diisi",
    });
  }

  // ================= VALIDASI ROLE =================
  const allowedRoles = ["karyawan", "pimpinan", "dokter", "resepsionis"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      message: "Role tidak valid",
    });
  }
  if (role === "dokter" && !spesialisasi) {
    return res.status(400).json({
      message: "Dokter wajib memilih spesialisasi",
    });
  }

  if (role !== "dokter" && !divisi) {
    return res.status(400).json({
      message: "Divisi wajib dipilih",
    });
  }
  try {
    // ================= CEK EMAIL / NIK SUDAH ADA =================
    const cekSql = `
      SELECT id 
      FROM users 
      WHERE email = ? OR nik = ?
      LIMIT 1
    `;

    db.query(cekSql, [email, nik], async (err, results) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }

      if (results.length > 0) {
        return res.status(400).json({
          message: "Email atau NIK sudah digunakan",
        });
      }

      // ================= HASH PASSWORD =================
      const hashedPassword = await bcrypt.hash(password, 10);

      // ================= INSERT USER =================
      const sql = `
        INSERT INTO users 
        (
          nama,
          nik,
          divisi,
          spesialisasi,
          email,
          no_hp,
          alamat,
          kelurahan,
          kecamatan,
          kota,
          provinsi,
          rt,
          rw,
          password,
          role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          nama,
          nik,
          divisi,
          spesialisasi,
          email,
          no_hp,
          alamat,
          kelurahan,
          kecamatan,
          kota,
          provinsi,
          rt,
          rw,
          hashedPassword,
          role,
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              error: err.message,
            });
          }

          res.json({
            message: "Akun berhasil dibuat",
            user_id: result.insertId,
          });
        },
      );
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= GET ALL USERS =================
exports.getAllUsers = (req, res) => {
  const sql = `
    SELECT 
      id,
      nama,
      nik,
      divisi,
      spesialisasi,
      email,
      no_hp,
      alamat,
      kelurahan,
      kecamatan,
      kota,
      provinsi,
      rt,
      rw,
      role,
      created_at
    FROM users
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json(results);
  });
};
// ================= GET DOKTER =================
exports.getDokter = (req, res) => {
  const sql = `
    SELECT
      id,
      nama,
      spesialisasi
    FROM users
    WHERE role = 'dokter'
    ORDER BY nama ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json(results);
  });
};

// ================= UPDATE USER BY RESEPSIONIS =================
exports.updateUser = async (req, res) => {
  const { id } = req.params;

  const {
    nama,
    nik,
    divisi,
    spesialisasi,
    email,
    no_hp,
    alamat,
    kelurahan,
    kecamatan,
    kota,
    provinsi,
    rt,
    rw,
    password,
    role,
  } = req.body;

  // ================= VALIDASI FIELD =================
  if (!nama || !nik || !email || !no_hp || !role) {
    return res.status(400).json({
      message: "Semua field wajib diisi",
    });
  }
  if (role === "dokter" && !spesialisasi) {
    return res.status(400).json({
      message: "Dokter wajib memilih spesialisasi",
    });
  }

  if (role !== "dokter" && !divisi) {
    return res.status(400).json({
      message: "Divisi wajib dipilih",
    });
  }
  // ================= VALIDASI ROLE =================
  const allowedRoles = ["karyawan", "pimpinan", "dokter", "resepsionis"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      message: "Role tidak valid",
    });
  }

  try {
    // ================= CEK USER ADA ATAU TIDAK =================
    db.query(
      "SELECT id FROM users WHERE id = ?",
      [id],
      async (err, userResult) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        if (userResult.length === 0) {
          return res.status(404).json({
            message: "Akun tidak ditemukan",
          });
        }

        // ================= CEK EMAIL / NIK DUPLIKAT SELAIN USER INI =================
        const cekDuplicateSql = `
        SELECT id
        FROM users
        WHERE (email = ? OR nik = ?)
        AND id != ?
        LIMIT 1
      `;

        db.query(
          cekDuplicateSql,
          [email, nik, id],
          async (err, duplicateResult) => {
            if (err) {
              return res.status(500).json({
                error: err.message,
              });
            }

            if (duplicateResult.length > 0) {
              return res.status(400).json({
                message: "Email atau NIK sudah digunakan akun lain",
              });
            }

            // ================= JIKA PASSWORD DIISI, UPDATE PASSWORD =================
            if (password && password.trim() !== "") {
              const hashedPassword = await bcrypt.hash(password, 10);

              const updateSql = `
            UPDATE users
            SET
              nama = ?,
              nik = ?,
              divisi = ?,
              spesialisasi = ?,
              email = ?,
              no_hp = ?,
              alamat = ?,
              kelurahan = ?,
              kecamatan = ?,
              kota = ?,
              provinsi = ?,
              rt = ?,
              rw = ?,
              password = ?,
              role = ?
            WHERE id = ?
          `;

              db.query(
                updateSql,
                [
                  nama,
                  nik,
                  divisi,
                  spesialisasi,
                  email,
                  no_hp,
                  alamat,
                  kelurahan,
                  kecamatan,
                  kota,
                  provinsi,
                  rt,
                  rw,
                  hashedPassword,
                  role,
                  id,
                ],
                (err, result) => {
                  if (err) {
                    return res.status(500).json({
                      error: err.message,
                    });
                  }

                  res.json({
                    message: "Akun berhasil diperbarui",
                  });
                },
              );

              return;
            }

            // ================= JIKA PASSWORD KOSONG, PASSWORD LAMA TETAP =================
            const updateSql = `
          UPDATE users
          SET
            nama = ?,
            nik = ?,
            divisi = ?,
            spesialisasi = ?,
            email = ?,
            no_hp = ?,
            alamat = ?,
            kelurahan = ?,
            kecamatan = ?,
            kota = ?,
            provinsi = ?,
            rt = ?,
            rw = ?,
            role = ?
          WHERE id = ?
        `;

            db.query(
              updateSql,
              [
                nama,
                nik,
                divisi,
                spesialisasi,
                email,
                no_hp,
                alamat,
                kelurahan,
                kecamatan,
                kota,
                provinsi,
                rt,
                rw,
                role,
                id,
              ],
              (err, result) => {
                if (err) {
                  return res.status(500).json({
                    error: err.message,
                  });
                }

                res.json({
                  message: "Akun berhasil diperbarui",
                });
              },
            );
          },
        );
      },
    );
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= DELETE USER BY RESEPSIONIS =================
exports.deleteUser = (req, res) => {
  const { id } = req.params;

  db.query("SELECT id FROM users WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Akun tidak ditemukan",
      });
    }

    db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }
      res.json({
        message: "Akun berhasil dihapus",
      });
    });
  });
};
// ================= UPDATE OWN PROFILE =================
exports.updateOwnProfile = async (req, res) => {
  try {
    // ================= AMBIL USER LOGIN =================
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token tidak ditemukan",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token tidak valid",
      });
    }
    const jwt = require("jsonwebtoken");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id;

    // ================= AMBIL DATA REQUEST =================
    const {
      email,
      no_hp,
      alamat,
      kelurahan,
      kecamatan,
      kota,
      provinsi,
      rt,
      rw,
      password,
    } = req.body;

    // ================= VALIDASI FIELD =================
    if (!email || !no_hp) {
      return res.status(400).json({
        message: "Semua field wajib diisi",
      });
    }

    // ================= CEK USER =================
    db.query(
      `
      SELECT 
        id,
        role
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId],
      async (err, results) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        if (results.length === 0) {
          return res.status(404).json({
            message: "User tidak ditemukan",
          });
        }

        const user = results[0];

        // ================= ROLE RESEPSIONIS =================
        // BOLEH EDIT SEMUA
        if (user.role === "resepsionis") {
          const { nama, nik, divisi, spesialisasi, role } = req.body;

          if (!nama || !nik || !role) {
            return res.status(400).json({
              message: "Data utama wajib diisi",
            });
          }
          if (role === "dokter" && !req.body.spesialisasi) {
            return res.status(400).json({
              message: "Dokter wajib memilih spesialisasi",
            });
          }
          // PASSWORD DIISI
          if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);

            const sql = `
              UPDATE users
              SET
                nama = ?,
                nik = ?,
                divisi = ?,
                spesialisasi = ?,
                email = ?,
                no_hp = ?,
                alamat = ?,
                kelurahan = ?,
                kecamatan = ?,
                kota = ?,
                provinsi = ?,
                rt = ?,
                rw = ?,
                password = ?,
                role = ?
              WHERE id = ?
            `;

            db.query(
              sql,
              [
                nama,
                nik,
                divisi,
                spesialisasi,
                email,
                no_hp,
                alamat,
                kelurahan,
                kecamatan,
                kota,
                provinsi,
                rt,
                rw,
                hashedPassword,
                role,
                userId,
              ],
              (err, result) => {
                if (err) {
                  return res.status(500).json({
                    error: err.message,
                  });
                }

                res.json({
                  message: "Profile berhasil diperbarui",
                });
              },
            );

            return;
          }

          // PASSWORD KOSONG
          const sql = `
            UPDATE users
            SET
              nama = ?,
              nik = ?,
              divisi = ?,
              spesialisasi = ?,
              email = ?,
              no_hp = ?,
              alamat = ?,
              kelurahan = ?,
              kecamatan = ?,
              kota = ?,
              provinsi = ?,
              rt = ?,
              rw = ?,
              role = ?
            WHERE id = ?
          `;

          db.query(
            sql,
            [
              nama,
              nik,
              divisi,
              spesialisasi,
              email,
              no_hp,
              alamat,
              kelurahan,
              kecamatan,
              kota,
              provinsi,
              rt,
              rw,
              role,
              userId,
            ],
            (err, result) => {
              if (err) {
                return res.status(500).json({
                  error: err.message,
                });
              }

              res.json({
                message: "Profile berhasil diperbarui",
              });
            },
          );

          return;
        }

        // ================= SELAIN RESEPSIONIS =================
        // HANYA BOLEH EDIT SEBAGIAN

        // PASSWORD DIISI
        if (password && password.trim() !== "") {
          const hashedPassword = await bcrypt.hash(password, 10);

          const sql = `
            UPDATE users
            SET
              email = ?,
              no_hp = ?,
              alamat = ?,
              kelurahan = ?,
              kecamatan = ?,
              kota = ?,
              provinsi = ?,
              rt = ?,
              rw = ?,
              password = ?
            WHERE id = ?
          `;

          db.query(
            sql,
            [
              email,
              no_hp,
              alamat,
              kelurahan,
              kecamatan,
              kota,
              provinsi,
              rt,
              rw,
              hashedPassword,
              userId,
            ],
            (err, result) => {
              if (err) {
                return res.status(500).json({
                  error: err.message,
                });
              }

              res.json({
                message: "Profile berhasil diperbarui",
              });
            },
          );

          return;
        }

        // PASSWORD KOSONG
        const sql = `
          UPDATE users
          SET
            email = ?,
            no_hp = ?,
            alamat = ?,
            kelurahan = ?,
            kecamatan = ?,
            kota = ?,
            provinsi = ?,
            rt = ?,
            rw = ?
          WHERE id = ?
        `;

        db.query(
          sql,
          [
            email,
            no_hp,
            alamat,
            kelurahan,
            kecamatan,
            kota,
            provinsi,
            rt,
            rw,
            userId,
          ],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                error: err.message,
              });
            }

            res.json({
              message: "Profile berhasil diperbarui",
            });
          },
        );
      },
    );
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Token tidak valid atau expired",
      });
    }

    res.status(500).json({
      error: error.message,
    });
  }
};
