const db = require("../config/db");

/// ================= GET ALL MEDICINES =================
exports.getMedicines = async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT *
      FROM medicines
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Gagal mengambil data obat",
    });
  }
};

/// ================= CREATE MEDICINE =================
exports.createMedicine = async (req, res) => {
  try {
    const { nama_obat, kategori, stok, expired_date } = req.body;

    // VALIDASI
    if (!nama_obat || !kategori || stok == null || !expired_date) {
      return res.status(400).json({
        message: "Semua field wajib diisi",
      });
    }

    if (stok < 0) {
      return res.status(400).json({
        message: "Stok tidak valid",
      });
    }

    await db.promise().query(
      `
      INSERT INTO medicines
      (
        nama_obat,
        kategori,
        stok,
        expired_date
      )
      VALUES (?, ?, ?, ?)
    `,
      [nama_obat, kategori, stok, expired_date],
    );

    res.json({
      success: true,
      message: "Obat berhasil ditambahkan",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Gagal menambah obat",
    });
  }
};

/// ================= UPDATE MEDICINE =================
exports.updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const { nama_obat, kategori, stok, expired_date } = req.body;

    // VALIDASI
    if (!nama_obat || !kategori || stok == null || !expired_date) {
      return res.status(400).json({
        message: "Semua field wajib diisi",
      });
    }

    if (stok < 0) {
      return res.status(400).json({
        message: "Stok tidak valid",
      });
    }

    const [result] = await db.promise().query(
      `
      UPDATE medicines
      SET
        nama_obat = ?,
        kategori = ?,
        stok = ?,
        expired_date = ?
      WHERE id = ?
    `,
      [nama_obat, kategori, stok, expired_date, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Obat tidak ditemukan",
      });
    }

    res.json({
      success: true,
      message: "Data obat berhasil diupdate",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Gagal update obat",
    });
  }
};

/// ================= DELETE MEDICINE =================
exports.deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.promise().query(
      `
      DELETE FROM medicines
      WHERE id = ?
    `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Obat tidak ditemukan",
      });
    }

    res.json({
      success: true,
      message: "Obat berhasil dihapus",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Gagal hapus obat",
    });
  }
};
