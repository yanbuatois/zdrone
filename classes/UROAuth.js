const url = require('url');
const UROAuth = require('urban-rivals-oauth');

/**
 * The Urban Rivals API
 * @type {CustomUROAuth}
 * @extends {UROAuth}
 */
class CustomUROAuth extends UROAuth {

  async getLoggedPlayer(throwErrors = false) {
    if (!(this.accessToken.token && this.accessToken.secret)) {
      return null;
    }

    const miniFunction = async () => {
      const queryResult = await this.query('general.getPlayer');
      const player = queryResult.context.player;
      console.log(player);
      return player;
    };
    if (throwErrors) {
      return await miniFunction();
    } else {
      try {
        return await miniFunction();
      } catch (err) {
        return null;
      }
    }
  }
}

module.exports = CustomUROAuth;
