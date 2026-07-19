const db = require("../config/db");

// tambah antrian
exports.createAntrian = (req, res) => {
  const { pengajuan_id } = req.body;

  const cekSql = `
    SELECT * FROM pengajuan 
    WHERE id = ? AND status = 'approved'
  `;

  db.query(cekSql, [pengajuan_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.length === 0) {
      return res.status(400).json({
        message: "Pengajuan belum di-approve",
      });
    }

    const nomorSql = `
      SELECT MAX(nomor_antrian) AS last 
      FROM pengajuan 
      WHERE DATE(tanggal_pengajuan) = CURDATE()
    `;

    db.query(nomorSql, (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const nomor = (rows[0].last || 0) + 1;

      const updateSql = `
        UPDATE pengajuan 
        SET status = 'antrian', nomor_antrian = ? 
        WHERE id = ?
      `;

      db.query(updateSql, [nomor, pengajuan_id], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });

        res.json({
          message: "Masuk antrian",
          nomor_antrian: nomor,
        });
      });
    });
  });
};

// narik semua data antrian
exports.getAllAntrian = (req, res) => {
  const sql = `
    SELECT * FROM pengajuan 
    WHERE status IN ('antrian','pemeriksaan') 
    ORDER BY nomor_antrian ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(results);
  });
};

// update status
exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  let sql = "UPDATE pengajuan SET status = ? WHERE id = ?";
  let values = [status, id];

  // kalau selesai → isi tanggal_selesai
  if (status === "selesai") {
    sql = `
      UPDATE pengajuan 
      SET status = ?, tanggal_selesai = NOW() 
      WHERE id = ?
    `;
  }

  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      message: `Status berhasil diubah ke ${status}`,
    });
  });
};
