const bcrypt = require("bcrypt");

async function generateHash() {
  const hash = await bcrypt.hash("123", 10);
  console.log("HASH:", hash);
}

generateHash();
