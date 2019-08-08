const fs = require('fs').promises;
const path = require('path');
const mkdirp = require('mkdirp');
const util = require('util');

const config = require('../config');

class TokensSaver {
  constructor(api, savePath = path.join(config.root, 'data', 'tokens.json')) {
    this.api = api;
    this.path = savePath;
  }

  async save() {
    if (this.api.accessToken) {
      const jsonContent = await JSON.stringify(this.api.accessToken);
      await util.promisify(mkdirp)(path.dirname(this.path));
      await fs.writeFile(this.path, jsonContent, {
        encoding: 'utf-8',
      });
      return true;
    }
    else {
      return false;
    }
  }

  async load() {
    try {
      const jsonContent = await fs.readFile(this.path, {
        encoding: 'utf-8',
      });
      if (jsonContent) {
        this.api.accessToken = JSON.parse(jsonContent);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }
}

module.exports = TokensSaver;
