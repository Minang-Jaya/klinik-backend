const db = require("../config/db");
const { messaging } = require("../config/firebase");
const io = () => global.io;
// ================= SAME DAY CHECK =================
const isDifferentDay = (tanggal) => {
  const date = new Date(tanggal);

  const now = new Date();

  return (
    date.getDate() !== now.getDate() ||
    date.getMonth() !== now.getMonth() ||
    date.getFullYear() !== now.getFullYear()
  );
};

// ================= CREATE PENGAJUAN =================
exports.createPengajuan = (req, res) => {
  const user_id = req.user.id;

  const { nama, nik, divisi, keluhan } = req.body;

  if (!nama || !nik || !divisi || !keluhan) {
    return res.status(400).json({
      message: "Semua field wajib diisi",
    });
  }

  const sql = `
  INSERT INTO pengajuan
  (
    user_id,
    nama,
    nik,
    divisi,
    keluhan,
    status
  )
  VALUES (?, ?, ?, ?, ?, ?)
`;
  db.query(
    sql,
    [user_id, nama, nik, divisi, keluhan, "pending"],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          error: err.message,
        });
      }

      console.log("=================================");
      console.log("CREATE PENGAJUAN BERHASIL");
      console.log(result);

      const notifSql = `
INSERT INTO notifications
(user_id, title, message, type)
VALUES (?, ?, ?, ?)
`;

      const getPimpinan = `
SELECT id
FROM users
WHERE role = 'pimpinan'
`;

      db.query(getPimpinan, (err, pimpinan) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        pimpinan.forEach((user) => {
          db.query(
            notifSql,
            [
              user.id,
              "Pengajuan Baru",
              `${nama} mengajukan pemeriksaan`,
              "pengajuan",
            ],
            (errNotif) => {
              if (errNotif) console.log(errNotif);
            },
          );
        });

        console.log("📢 Emit ke room pimpinan");

        io()
          .to("pimpinan")
          .emit("pengajuanBaru", {
            title: "Pengajuan Baru",
            message: `${nama} mengajukan pemeriksaan`,
            nama,
            nik,
            divisi,
            keluhan,
          });

        console.log("✅ Emit selesai");
        // ================= PUSH NOTIFICATION =================
        db.query(
          `
  SELECT fcm_token
  FROM users
  WHERE role = 'pimpinan'
    AND fcm_token IS NOT NULL
  `,
          async (err, rows) => {
            if (err) {
              console.log(err);
              return;
            }

            const tokens = rows.map((r) => r.fcm_token);

            if (tokens.length === 0) {
              console.log("Tidak ada FCM Token pimpinan");
              return;
            }

            try {
              const response = await messaging.sendEachForMulticast({
                tokens,
                notification: {
                  title: "Pengajuan Baru",
                  body: `${nama} mengajukan pemeriksaan`,
                },
                data: {
                  type: "pengajuan",
                  nama,
                  nik,
                  divisi,
                },
              });

              console.log("Push Notification Success");
              console.log(response);
            } catch (e) {
              console.log("Push Notification Error");
              console.log(e);
            }
          },
        );
        res.json({
          message: "Pengajuan berhasil dibuat",
        });
      });
    },
  );
};

// ================= GET ALL PENGAJUAN =================
exports.getAllPengajuan = (req, res) => {
  const role = req.user.role;

  const userId = req.user.id;

  let sql = "";

  let params = [];

  // ================= KARYAWAN =================
  if (role === "karyawan") {
    sql = `
    SELECT *
    FROM pengajuan
    WHERE user_id = ?
    ORDER BY tanggal_pengajuan DESC
  `;

    params = [userId];
  }

  // ================= DOKTER =================
  else if (role === "dokter") {
    sql = `
    SELECT *
    FROM pengajuan
    WHERE dokter_id = ?
    ORDER BY tanggal_pengajuan DESC
  `;

    params = [userId];
  }

  // ================= ROLE LAIN =================
  else {
    sql = `
    SELECT *
    FROM pengajuan
    ORDER BY tanggal_pengajuan DESC
  `;
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    res.json(results);
  });
};

// ================= UPDATE STATUS =================
exports.updateStatus = (req, res) => {
  const { id } = req.params;

  const { status, alasan_reject, dokter_id } = req.body;
  const role = req.user.role;

  let allowedStatus = [];

  // ================= PIMPINAN =================
  if (role === "pimpinan") {
    allowedStatus = ["approved", "rejected"];
  }

  // ================= RESEPSIONIS =================
  else if (role === "resepsionis") {
    allowedStatus = ["antrian", "dipanggil"];
  }

  // ================= DOKTER =================
  else if (role === "dokter") {
    allowedStatus = ["pemeriksaan", "belum_masuk", "selesai"];
  }
  // ================= INVALID ROLE =================
  else {
    return res.status(403).json({
      message: "Akses ditolak",
    });
  }

  // ================= INVALID STATUS =================
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({
      message: "Status tidak valid",
    });
  }

  db.query("SELECT * FROM pengajuan WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Pengajuan tidak ditemukan",
      });
    }

    const pengajuan = results[0];

    // =====================================================
    // PIMPINAN
    // =====================================================

    if (role === "pimpinan") {
      // pending only
      if (pengajuan.status !== "pending") {
        return res.status(400).json({
          message: "Hanya pengajuan pending yang bisa diproses",
        });
      }

      // expired
      if (isDifferentDay(pengajuan.tanggal_pengajuan)) {
        return res.status(400).json({
          message: "Pengajuan sudah kadaluwarsa",
        });
      }

      // reject wajib alasan
      if (
        status === "rejected" &&
        (!alasan_reject || alasan_reject.trim() === "")
      ) {
        return res.status(400).json({
          message: "Alasan reject wajib diisi",
        });
      }

      let sql = "";

      let params = [];

      // ================= REJECT =================
      if (status === "rejected") {
        sql = `
            UPDATE pengajuan
            SET
              status = ?,
              alasan_reject = ?
            WHERE id = ?
          `;

        params = [status, alasan_reject, id];
      }

      // ================= APPROVE =================
      else {
        sql = `
            UPDATE pengajuan
            SET
              status = ?,
              alasan_reject = NULL
            WHERE id = ?
          `;

        params = [status, id];
      }

      db.query(sql, params, (err, result) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }
        if (status === "approved") {
          // ================= NOTIF KE KARYAWAN =================
          db.query(
            `
    INSERT INTO notifications
    (user_id,title,message,type)
    VALUES (?,?,?,?)
    `,
            [
              pengajuan.user_id,
              "Pengajuan Disetujui",
              "Pengajuan Anda telah disetujui oleh pimpinan. Silakan menunggu nomor antrian dari resepsionis.",
              "approved",
            ],
          );

          // ================= CARI SEMUA RESEPSIONIS =================
          db.query(
            `
    SELECT id
    FROM users
    WHERE role = 'resepsionis'
    `,
            (err, resepsionis) => {
              if (err) {
                console.log(err);
                return;
              }

              resepsionis.forEach((user) => {
                // simpan ke tabel notifications
                db.query(
                  `
          INSERT INTO notifications
          (user_id,title,message,type)
          VALUES (?,?,?,?)
          `,
                  [
                    user.id,
                    "Pengajuan Baru",
                    `${pengajuan.nama} telah disetujui pimpinan. Silakan berikan nomor antrian.`,
                    "approved_pengajuan",
                  ],
                );
              });

              // ================= SOCKET REALTIME =================
              io()
                .to("resepsionis")
                .emit("pengajuanApproved", {
                  title: "Pengajuan Baru",
                  message: `${pengajuan.nama} telah disetujui pimpinan.`,
                  pengajuan_id: pengajuan.id,
                  nama: pengajuan.nama,
                  divisi: pengajuan.divisi,
                });

              // ================= PUSH KE RESEPSIONIS =================
              db.query(
                `
  SELECT fcm_token
  FROM users
  WHERE role = 'resepsionis'
    AND fcm_token IS NOT NULL
  `,
                async (err, rows) => {
                  if (err) {
                    console.log(err);
                    return;
                  }

                  const tokens = rows.map((r) => r.fcm_token);

                  if (tokens.length === 0) {
                    console.log("Tidak ada FCM Token resepsionis");
                    return;
                  }

                  try {
                    const response = await messaging.sendEachForMulticast({
                      tokens,
                      notification: {
                        title: "Pengajuan Baru",
                        body: `${pengajuan.nama} telah disetujui pimpinan. Silakan berikan nomor antrian.`,
                      },
                      data: {
                        type: "approved_pengajuan",
                        pengajuan_id: pengajuan.id.toString(),
                        nama: pengajuan.nama,
                        divisi: pengajuan.divisi,
                      },
                    });

                    console.log("Push Notification ke resepsionis berhasil");
                    console.log(response);
                  } catch (e) {
                    console.log("Push Notification Error");
                    console.log(e);
                  }
                },
              );
            },
          );
        } else {
          db.query(
            `
    INSERT INTO notifications
    (user_id,title,message,type)
    VALUES (?,?,?,?)
    `,
            [
              pengajuan.user_id,
              "Pengajuan Ditolak",
              `Pengajuan Anda ditolak.\n\nAlasan: ${alasan_reject}`,
              "rejected",
            ],
          );
        }
        io()
          .to(`user_${pengajuan.user_id}`)
          .emit("statusPengajuan", {
            status,
            message:
              status === "approved"
                ? "Pengajuan Anda disetujui."
                : "Pengajuan Anda ditolak.",
          });
        // ================= PUSH KE KARYAWAN =================
        db.query(
          `
  SELECT fcm_token
  FROM users
  WHERE id = ?
  `,
          [pengajuan.user_id],
          async (err, rows) => {
            if (err) {
              console.log(err);
              return;
            }

            if (rows.length === 0 || !rows[0].fcm_token) {
              console.log("FCM Token karyawan tidak ditemukan");
              return;
            }

            try {
              await messaging.send({
                token: rows[0].fcm_token,
                notification: {
                  title:
                    status === "approved"
                      ? "Pengajuan Disetujui"
                      : "Pengajuan Ditolak",
                  body:
                    status === "approved"
                      ? "Pengajuan Anda telah disetujui."
                      : `Pengajuan Anda ditolak.\nAlasan: ${alasan_reject}`,
                },
                data: {
                  type: status,
                  pengajuan_id: pengajuan.id.toString(),
                },
              });

              console.log("Push notification berhasil");
            } catch (e) {
              console.log(e);
            }
          },
        );
        res.json({
          message: "Status berhasil diupdate",
        });
      });

      return;
    }

    // =====================================================
    // MASUK ANTRIAN
    // =====================================================

    if (role === "resepsionis" && status === "antrian") {
      // approved only
      if (pengajuan.status !== "approved") {
        return res.status(400).json({
          message: "Hanya pengajuan approved yang bisa masuk antrian",
        });
      }

      // approved harus hari ini
      if (isDifferentDay(pengajuan.tanggal_pengajuan)) {
        return res.status(400).json({
          message: "Approved sudah kadaluwarsa",
        });
      }

      // ================= RESET NOMOR ANTRIAN TIAP HARI =================
      const nomorSql = `
          SELECT
            COALESCE(MAX(nomor_antrian), 0) + 1
            AS nomor_antrian
          FROM pengajuan
          WHERE DATE(tanggal_antrian) = CURDATE()
        `;

      db.query(nomorSql, (err, nomorResult) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }

        const nomorAntrian = nomorResult[0].nomor_antrian;

        const updateSql = `
              UPDATE pengajuan
              SET
                status = ?,
                nomor_antrian = ?,
                tanggal_antrian = NOW()
              WHERE id = ?
            `;

        db.query(updateSql, [status, nomorAntrian, id], (err, result) => {
          if (err) {
            return res.status(500).json({
              error: err.message,
            });
          }

          // ================= SIMPAN NOTIF =================
          db.query(
            `
    INSERT INTO notifications
    (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
    `,
            [
              pengajuan.user_id,
              "Nomor Antrian",
              `Nomor antrian Anda ${nomorAntrian}. Silakan menunggu panggilan.`,
              "antrian",
            ],
            (errNotif) => {
              if (errNotif) {
                console.log("Gagal simpan notif:", errNotif);
              }
            },
          );

          io()
            .to(`user_${pengajuan.user_id}`)
            .emit("nomorAntrian", {
              nomor_antrian: nomorAntrian,
              message: `Nomor antrian Anda ${nomorAntrian}`,
            });
          db.query(
            `
SELECT fcm_token
FROM users
WHERE id = ?
`,
            [pengajuan.user_id],
            async (err, rows) => {
              if (rows.length === 0 || !rows[0].fcm_token) return;

              try {
                await messaging.send({
                  token: rows[0].fcm_token,
                  notification: {
                    title: "Nomor Antrian",
                    body: `Nomor antrian Anda ${nomorAntrian}.`,
                  },
                  data: {
                    type: "antrian",
                    nomor_antrian: nomorAntrian.toString(),
                  },
                });
              } catch (e) {
                console.log(e);
              }
            },
          );
          res.json({
            message: "Berhasil masuk antrian",
            nomor_antrian: nomorAntrian,
          });
        });
      });

      return;
    }
    // =====================================================
    // DIPANGGIL
    // =====================================================

    if (role === "resepsionis" && status === "dipanggil") {
      // hanya pasien antrian
      if (pengajuan.status !== "antrian") {
        return res.status(400).json({
          message: "Hanya pasien antrian yang bisa dipanggil",
        });
      }

      if (
        !pengajuan.tanggal_antrian ||
        isDifferentDay(pengajuan.tanggal_antrian)
      ) {
        return res.status(400).json({
          message: "Antrian sudah kadaluwarsa",
        });
      }

      const sql = `
UPDATE pengajuan
SET
  status = ?,
  dokter_id = ?,
  reminder_needed = 0
WHERE id = ?
`;

      db.query(sql, ["dipanggil", dokter_id, id], (err) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }
        // ================= NOTIF KE DOKTER =================
        db.query(
          `
  SELECT id, nama, fcm_token
  FROM users
  WHERE id = ?
  `,
          [dokter_id],
          async (err, dokterRows) => {
            if (err || dokterRows.length === 0) return;

            const dokter = dokterRows[0];

            // Simpan notifikasi
            db.query(
              `
      INSERT INTO notifications
      (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
      `,
              [
                dokter.id,
                "Pasien Dipanggil",
                `${pengajuan.nama} sedang menuju ruang pemeriksaan.`,
                "dipanggil",
              ],
            );

            // Socket
            io().to(`user_${dokter.id}`).emit("pasienDipanggil", {
              pengajuan_id: pengajuan.id,
              nama: pengajuan.nama,
              nomor_antrian: pengajuan.nomor_antrian,
            });

            // Push
            if (dokter.fcm_token) {
              try {
                await messaging.send({
                  token: dokter.fcm_token,
                  notification: {
                    title: "Pasien Dipanggil",
                    body: `${pengajuan.nama} sedang menuju ruang pemeriksaan.`,
                  },
                  data: {
                    type: "dipanggil",
                    pengajuan_id: pengajuan.id.toString(),
                  },
                });
              } catch (e) {
                console.log(e);
              }
            }
          },
        );
        // ================= SIMPAN NOTIF =================
        db.query(
          `
      INSERT INTO notifications
      (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
      `,
          [
            pengajuan.user_id,
            "Panggilan Pemeriksaan",
            "Nomor antrian Anda telah dipanggil. Silakan menuju ruang dokter.",
            "dipanggil",
          ],
        );

        // ================= SOCKET =================
        io().to(`user_${pengajuan.user_id}`).emit("dipanggil", {
          message: "Silakan menuju ruang dokter.",
        });

        // ================= PUSH =================
        db.query(
          `
      SELECT fcm_token
      FROM users
      WHERE id = ?
      `,
          [pengajuan.user_id],
          async (err, rows) => {
            if (rows.length === 0 || !rows[0].fcm_token) return;

            try {
              await messaging.send({
                token: rows[0].fcm_token,
                notification: {
                  title: "Panggilan Pemeriksaan",
                  body: "Nomor antrian Anda telah dipanggil. Silakan menuju ruang dokter.",
                },
                data: {
                  type: "dipanggil",
                },
              });
            } catch (e) {
              console.log(e);
            }
          },
        );

        res.json({
          message: "Pasien berhasil dipanggil",
        });
      });

      return;
    }
    // =====================================================
    // PEMERIKSAAN
    // =====================================================

    if (role === "dokter" && status === "pemeriksaan") {
      // antrian only
      if (pengajuan.status !== "dipanggil") {
        return res.status(400).json({
          message: "Hanya pasien yang sudah dipanggil yang bisa diperiksa",
        });
      }

      // antrian harus hari ini
      if (
        !pengajuan.tanggal_antrian ||
        isDifferentDay(pengajuan.tanggal_antrian)
      ) {
        return res.status(400).json({
          message: "Antrian sudah kadaluwarsa",
        });
      }

      // dokter wajib dipilih
      // if (!dokter_id) {
      // return res.status(400).json({
      // message: "Dokter harus dipilih",
      //});
      //  }
      const sql = `
UPDATE pengajuan
SET status = ?
WHERE id = ?
`;

      db.query(sql, [status, id], (err, result) => {
        if (err) {
          return res.status(500).json({
            error: err.message,
          });
        }
        // ================= NOTIF KE DOKTER =================
        db.query(
          `
  SELECT id, nama, fcm_token
  FROM users
  WHERE id = ?
  `,
          [pengajuan.dokter_id],
          async (err, dokterRows) => {
            if (err || dokterRows.length === 0) return;

            const dokter = dokterRows[0];

            // SOCKET
            io().to(`user_${dokter.id}`).emit("pasienMasuk", {
              pengajuan_id: pengajuan.id,
              nama: pengajuan.nama,
              nomor_antrian: pengajuan.nomor_antrian,
            });

            // PUSH
            if (dokter.fcm_token) {
              try {
                await messaging.send({
                  token: dokter.fcm_token,
                  notification: {
                    title: "Pasien Baru",
                    body: `${pengajuan.nama} siap diperiksa`,
                  },
                  data: {
                    type: "pasien_masuk",
                    pengajuan_id: pengajuan.id.toString(),
                  },
                });
              } catch (e) {
                console.log(e);
              }
            }
          },
        );
        db.query(
          `
  INSERT INTO notifications
  (user_id, title, message, type)
  VALUES (?, ?, ?, ?)
  `,
          [
            pengajuan.dokter_id,
            "Pasien Baru",
            `${pengajuan.nama} siap diperiksa.`,
            "pasien_masuk",
          ],
        );
        res.json({
          message: "Pasien masuk pemeriksaan",
        });
      });

      return;
    }
    // =====================================================
    // PASIEN BELUM MASUK
    // =====================================================
    if (role === "dokter" && status === "belum_masuk") {
      if (pengajuan.status !== "dipanggil") {
        return res.status(400).json({
          message: "Pasien belum dalam status dipanggil",
        });
      }
      db.query(
        `
  UPDATE pengajuan
  SET reminder_needed = 1
  WHERE id = ?
  `,
        [id],
      );
      db.query(
        `
    SELECT id, fcm_token
    FROM users
    WHERE role='resepsionis'
    `,
        async (err, rows) => {
          if (!err) {
            for (const user of rows) {
              db.query(
                `
            INSERT INTO notifications
            (user_id,title,message,type)
            VALUES (?,?,?,?)
            `,
                [
                  user.id,
                  "Pasien Belum Masuk",
                  `${pengajuan.nama} belum masuk ke ruang dokter.`,
                  "belum_masuk",
                ],
              );

              io().to(`user_${user.id}`).emit("belumMasuk", {
                pengajuan_id: pengajuan.id,
                nama: pengajuan.nama,
              });

              if (user.fcm_token) {
                try {
                  await messaging.send({
                    token: user.fcm_token,
                    notification: {
                      title: "Pasien Belum Masuk",
                      body: `${pengajuan.nama} belum masuk ke ruang dokter.`,
                    },
                    data: {
                      type: "belum_masuk",
                    },
                  });
                } catch (e) {
                  console.log(e);
                }
              }
            }
          }

          return res.json({
            message: "Resepsionis berhasil diberi notifikasi",
          });
        },
      );

      return;
    }
    return res.status(400).json({
      message: "Aksi tidak valid",
    });
  });
};
// ================= INGATKAN PASIEN =================
exports.remindPatient = (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT * FROM pengajuan WHERE id = ?",
    [id],
    async (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      if (results.length === 0) {
        return res.status(404).json({
          message: "Pengajuan tidak ditemukan",
        });
      }

      const pengajuan = results[0];

      db.query(
        "SELECT fcm_token FROM users WHERE id = ?",
        [pengajuan.user_id],
        async (err, rows) => {
          // simpan notif
          db.query(
            `
            INSERT INTO notifications
            (user_id,title,message,type)
            VALUES (?,?,?,?)
            `,
            [
              pengajuan.user_id,
              "Pengingat Pemeriksaan",
              "Dokter sedang menunggu Anda. Mohon segera menuju ruang dokter.",
              "reminder",
            ],
          );

          // socket
          io().to(`user_${pengajuan.user_id}`).emit("reminder", {
            message:
              "Dokter sedang menunggu Anda. Mohon segera menuju ruang dokter.",
          });

          // push
          if (!err && rows.length && rows[0].fcm_token) {
            try {
              await messaging.send({
                token: rows[0].fcm_token,
                notification: {
                  title: "Pengingat Pemeriksaan",
                  body: "Dokter sedang menunggu Anda.",
                },
                data: {
                  type: "reminder",
                },
              });
            } catch (e) {
              console.log(e);
            }
          }
          db.query(
            `
  UPDATE pengajuan
  SET reminder_needed = 0
  WHERE id = ?
  `,
            [id],
          );
          res.json({
            message: "Pengingat berhasil dikirim",
          });
        },
      );
    },
  );
};
