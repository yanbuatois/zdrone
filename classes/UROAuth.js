/**
 * Token info
 * @typedef {Object} Token Token info
 * @property {string} token Token public
 * @property {string} secret Token secret
 */

/**
 * Query
 * @typedef {Object} QueryObject Query
 * @property {String} call Call name
 * @property {Object} [params={}] params of the query
 */

const url = require('url');
const { OAuth } = require('oauth');

/**
 * The Urban Rivals API
 * @type {UROAuth}
 * @extends {OAuth}
 */
class UROAuth extends OAuth {
  /**
   *
   * @param key Application key
   * @param secret Application secret
   * @param [algorithm='HMAC-SHA1'] Signing method
   * @param [authorizeCallback=null] Callback called when authorized
   */
  constructor({
    key,
    secret,
    algorithm = 'HMAC-SHA1',
    authorizeCallback = null,
  }) {
    super(
      'https://www.urban-rivals.com/api/auth/request_token.php',
      'http://www.urban-rivals.com/api/auth/access_token.php',
      key,
      secret,
      '1.0',
      authorizeCallback,
      algorithm,
    );

    /**
     * query URL
     * @type {String}
     */
    this.apiUrl = 'https://www.urban-rivals.com/api/';

    /**
     * Authorization URL
     * @type {String}
     */
    this.authorizeUrl = 'https://www.urban-rivals.com/api/auth/authorize.php';

    /**
     * Request token
     * @type {Token}
     */
    this.requestToken = {};

    /**
     * Access token
     * @type {Token}
     */
    this.accessToken = {};
  }

  /**
   * Get request token
   * @return {Promise<Token>}
   */
  getRequestToken() {
    return new Promise((resolve, reject) => {
      this.getOAuthRequestToken((err, token, token_secret) => {
        if (err) {
          reject(err);
        }
        else {

          const tokenObject = {
            token: token,
            secret: token_secret
          };

          this.requestToken = tokenObject;

          resolve(tokenObject);
        }
      });
    });
  }

  /**
   * Get access token from request token
   * @param {Token} requestToken Request token
   * @param {string} userToken Verifier
   * @return {Promise<Token>}
   */
  getAccessToken({
    requestToken = this.requestToken,
    userToken,
  }) {
    return new Promise((resolve, reject) => {
      this.getOAuthAccessToken(requestToken.token, requestToken.secret, userToken, (err, accessToken, accessSecret, results) => {

        if(err)
          reject(err);
        else {
            this.accessToken = {
            token: accessToken,
            secret: accessSecret
          };

          resolve(this.token);
        }
      })
    });
  }

  /**
   * Do one or more queries on the UR API
   * @param queries {QueryObject} All queries to do
   * @returns {Promise<Object>} The queries result
   */
  multipleQueries(...queries) {
    const queriesToDo = queries.map(({call, params = {}}) => {
      return {
        call,
        params,
      };
    });

    const jsonEncodedQuery = JSON.stringify(queriesToDo);
    return new Promise((resolve, reject) => {
      this.post(this.apiUrl, this.accessToken.token, this.accessToken.secret, {
        "request": jsonEncodedQuery,
      }, 'application/x-www-form-urlencoded', (err, response, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(JSON.parse(response));
        }
      });
    });
  }

  /**
   * Do one query
   * @param call Call name
   * @param [params={}] Call params
   * @returns {Promise<Object>} The query result
   */
  async query(call, params = {}) {
    return (await this.multipleQueries({
      call,
      params
    }))[call];
  }


  /**
   * Get the authorization URL for the player
   * @param [callbackUrl] The callback url for the query
   * @returns {string} The authorize URL
   */
  getAuthorizeUrl(callbackUrl = '') {
    const authorizeUrl = url.parse(this.authorizeUrl);
    authorizeUrl.query = {
      'oauth_token': this.requestToken.token,
    };
    if (callbackUrl) {
      authorizeUrl.query['oauth_callback'] = callbackUrl;
    }

    return url.format(authorizeUrl);
  }

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

module.exports = UROAuth;
