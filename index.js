const Zdrone = require('./classes/Zdrone');

// (async () => {
//   const urOauth = new UROAuth({
//     key: config.key,
//     secret: config.secret,
//   });
//
//   await urOauth.getRequestToken();
//   console.log(urOauth.getAuthorizeUrl('http://localhost'));
//   const verifier = await promptly.prompt('Authorize token ?');
//   await urOauth.getAccessToken({userToken: verifier});
//   console.log(await urOauth.query('general.getPlayer'));
// })().catch(err => console.error(err));

const bot = new Zdrone();
bot.start();
