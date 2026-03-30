const bcrypt = require("bcrypt");

async function run() {
  const password = "123456"; // change this if needed
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}

run();