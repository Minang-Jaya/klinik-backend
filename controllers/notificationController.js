const db = require("../config/db");

// ================= GET NOTIFICATIONS =================
exports.getNotifications = (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT *
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json(results);
  });
};

// ================= READ NOTIFICATION =================
exports.readNotification = (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE notifications
    SET is_read = 1
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json({
      message: "Notifikasi dibaca",
    });
  });
};

// ================= DELETE NOTIFICATION =================
exports.deleteNotification = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const sql = `
    DELETE FROM notifications
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, userId], (err, result) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Notifikasi tidak ditemukan",
      });
    }

    res.json({
      message: "Notifikasi berhasil dihapus",
    });
  });
};
