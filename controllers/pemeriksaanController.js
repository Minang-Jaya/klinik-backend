const db = require("../config/db");

// ================= GET ALL PEMERIKSAAN =================
exports.getAllPemeriksaan = async (req, res) => {
  try {
    const sql = `
      SELECT
        pemeriksaan.*,
        pengajuan.nama,
        pengajuan.nik,
        pengajuan.divisi,
        pengajuan.keluhan,
        pengajuan.nomor_antrian,
        users.nama AS nama_dokter,
        users.nik AS nik_dokter
      FROM pemeriksaan
      JOIN pengajuan
        ON pemeriksaan.pengajuan_id = pengajuan.id
      JOIN users
        ON pemeriksaan.dokter_id = users.id
      ORDER BY pemeriksaan.tanggal_pemeriksaan DESC
    `;

    const [results] = await db.promise().query(sql);

    // ================= AMBIL DETAIL OBAT =================
    for (const item of results) {
      const [detailRows] = await db.promise().query(
        `
        SELECT
          detail_pemeriksaan.id,
          detail_pemeriksaan.dosis,
          medicines.id AS medicine_id,
          medicines.nama_obat,
          medicines.kategori
        FROM detail_pemeriksaan
        JOIN medicines
          ON detail_pemeriksaan.medicine_id = medicines.id
        WHERE detail_pemeriksaan.pemeriksaan_id = ?
        `,
        [item.id],
      );

      item.detail_obat = detailRows;
    }

    res.json(results);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= CREATE PEMERIKSAAN =================
exports.createPemeriksaan = async (req, res) => {
  try {
    const dokter_id = req.user.id;

    const { pengajuan_id, diagnosa, obat } = req.body;

    // ================= VALIDASI =================
    if (
      !pengajuan_id ||
      !diagnosa ||
      !obat ||
      !Array.isArray(obat) ||
      obat.length === 0
    ) {
      return res.status(400).json({
        message: "Semua field wajib diisi",
      });
    }

    // ================= CEK PENGAJUAN =================
    const cekSql = `
      SELECT *
      FROM pengajuan
      WHERE id = ?
      LIMIT 1
    `;

    const [pengajuanRows] = await db.promise().query(cekSql, [pengajuan_id]);

    if (pengajuanRows.length === 0) {
      return res.status(404).json({
        message: "Pengajuan tidak ditemukan",
      });
    }

    const pengajuan = pengajuanRows[0];

    if (pengajuan.status !== "pemeriksaan") {
      return res.status(400).json({
        message: "Pasien belum masuk tahap pemeriksaan",
      });
    }

    // ================= INSERT PEMERIKSAAN =================
    const insertSql = `
      INSERT INTO pemeriksaan
      (
        pengajuan_id,
        dokter_id,
        diagnosa
      )
      VALUES (?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query(insertSql, [pengajuan_id, dokter_id, diagnosa]);

    const pemeriksaanId = result.insertId;

    // ================= INSERT DETAIL OBAT =================
    for (const item of obat) {
      if (!item.medicine_id || !item.dosis) {
        return res.status(400).json({
          message: "Data obat tidak lengkap",
        });
      }

      // INSERT DETAIL
      await db.promise().query(
        `
        INSERT INTO detail_pemeriksaan
        (
          pemeriksaan_id,
          medicine_id,
          dosis
        )
        VALUES (?, ?, ?)
        `,
        [pemeriksaanId, item.medicine_id, item.dosis],
      );

      // KURANGI STOK
      await db.promise().query(
        `
        UPDATE medicines
        SET stok = stok - 1
        WHERE id = ? AND stok > 0
        `,
        [item.medicine_id],
      );
    }

    // ================= UPDATE STATUS =================
    await db.promise().query(
      `
      UPDATE pengajuan
      SET
        status = 'selesai',
        tanggal_selesai = NOW()
      WHERE id = ?
      `,
      [pengajuan_id],
    );

    return res.status(201).json({
      message: "Pemeriksaan berhasil disimpan",
      pemeriksaan_id: pemeriksaanId,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// ================= UPDATE PEMERIKSAAN =================
exports.updatePemeriksaan = async (req, res) => {
  try {
    const { id } = req.params;

    const { diagnosa, obat } = req.body;

    // ================= VALIDASI =================
    if (!diagnosa || !obat || !Array.isArray(obat) || obat.length === 0) {
      return res.status(400).json({
        message: "Semua field wajib diisi",
      });
    }

    // ================= CEK PEMERIKSAAN =================
    const [pemeriksaanRows] = await db.promise().query(
      `
      SELECT *
      FROM pemeriksaan
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    if (pemeriksaanRows.length === 0) {
      return res.status(404).json({
        message: "Data pemeriksaan tidak ditemukan",
      });
    }

    // ================= UPDATE DIAGNOSA =================
    await db.promise().query(
      `
      UPDATE pemeriksaan
      SET diagnosa = ?
      WHERE id = ?
      `,
      [diagnosa, id],
    );

    // ================= AMBIL DETAIL LAMA =================
    const [oldDetails] = await db.promise().query(
      `
      SELECT *
      FROM detail_pemeriksaan
      WHERE pemeriksaan_id = ?
      `,
      [id],
    );

    // ================= BALIKIN STOK LAMA =================
    for (const oldItem of oldDetails) {
      await db.promise().query(
        `
        UPDATE medicines
        SET stok = stok + 1
        WHERE id = ?
        `,
        [oldItem.medicine_id],
      );
    }

    // ================= HAPUS DETAIL LAMA =================
    await db.promise().query(
      `
      DELETE FROM detail_pemeriksaan
      WHERE pemeriksaan_id = ?
      `,
      [id],
    );

    // ================= INSERT DETAIL BARU =================
    for (const item of obat) {
      if (!item.medicine_id || !item.dosis) {
        return res.status(400).json({
          message: "Data obat tidak lengkap",
        });
      }

      // INSERT DETAIL
      await db.promise().query(
        `
        INSERT INTO detail_pemeriksaan
        (
          pemeriksaan_id,
          medicine_id,
          dosis
        )
        VALUES (?, ?, ?)
        `,
        [id, item.medicine_id, item.dosis],
      );

      // KURANGI STOK
      await db.promise().query(
        `
        UPDATE medicines
        SET stok = stok - 1
        WHERE id = ? AND stok > 0
        `,
        [item.medicine_id],
      );
    }

    return res.json({
      message: "Pemeriksaan berhasil diperbarui",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: error.message,
    });
  }
};
