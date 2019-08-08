const path = require('path');
require('dotenv').config();

module.exports = {
  key: process.env.KEY,
  secret: process.env.SECRET,
  botToken: process.env.BOT_TOKEN,
  ownerId: process.env.OWNER_ID,
  root: path.resolve(__dirname),
};
