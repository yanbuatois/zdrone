const { CommandClient } = require('discord-js-command-client');
const { Permissions } = require('discord.js');

const UROAuth = require('./UROAuth');
const TokensSaver = require('./TokensSaver');
const Trivia = require('./Trivia');
const config = require('../config');

class Zdrone extends CommandClient {
  constructor() {
    super('//');
    this.urApi = new UROAuth({
      key: config.key,
      secret: config.secret,
    });
    this.tokensSaver = new TokensSaver(this.urApi);
    this.trivias = {};
  }

  start(token = config.botToken) {
    this.on('ready', async () => {
      let player;
      try {
        if (!await this.tokensSaver.load() || !(player = await this.urApi.getLoggedPlayer())) {
          await this.urApi.getRequestToken();
          this.owner = await this.fetchUser(config.ownerId);
          await this.owner.send(this.urApi.getAuthorizeUrl('http://localhost/'));
          player = await new Promise((resolve, reject) => {
            const verifierCallback = async (message) => {
              if (message.channel.type === 'dm' && message.channel.recipient.id === this.owner.id && message.author.id === this.owner.id) {
                try {
                  await this.urApi.getAccessToken({
                    userToken: message.content,
                  });
                  const player = await this.urApi.getLoggedPlayer(true);
                  this.removeListener('message', verifierCallback);
                  resolve(player);
                } catch (err) {
                  console.error(err);
                  message.reply(err.data || err.message).catch(err => console.error(err));
                }
              }
            };
            this.on('message', verifierCallback);
          });
          await this.tokensSaver.save();
        }
      } catch (err) {
        console.error(err);
      }
      console.log(`Authenticated as ${player.name}`);
    });
    this.registerAllCommands();
    this.login(token);
  }

  registerAllCommands() {
    this.registerCommand('eval', async (message, commandName, args) => {
      if (message.author.id !== config.ownerId) {
        return;
      }
      const joinedString = args.join(' ');
      try {
        message.reply(eval(joinedString));
      }
      catch (err) {
        console.error(err);
        message.reply(err.message || err.data);
      }
    } , {
      displayInHelp: false,
      minArgs: 1,
      dmAllowed: true,
    });

    this.registerCommand('api', async (message, commandName, args) => {
      if (message.author.id !== config.ownerId) {
        return;
      }
      try {
        const [call, ...data] = args;
        const callArgs = data.join(' ') || '{}';
        const returnValue = await this.urApi.query(call, JSON.parse(callArgs));
        const reply = this._sliceMessage(JSON.stringify(returnValue));
        await Promise.all(reply.map(elt => message.channel.send('```' + elt + '```')));
        console.log(returnValue);
      } catch (err) {
        await Promise.all((this._sliceMessage(err.message || err.data).map(elt => message.channel.send(elt))));
        console.error(err);
      }
    }, {
      displayInHelp: false,
      minArgs: 1,
      dmAllowed: true,
    });

    this.registerCommand('trivia', async (message, commandName, args) => {
      if (this.trivias[message.channel.id] && this.trivias[message.channel.id].running) {
        message.reply('A trivia is already running here.');
      } else {
        const [rounds = 10, illustrationRate = 33, biographyRate = 33, abilityRate = 33] = args;
        this.trivias[message.channel.id] = new Trivia({
          channel: message.channel,
          discordClient: this,
          rounds,
          illustrationRate,
          biographyRate,
          abilityRate,
        });
        await Promise.all([message.channel.send(`${rounds} rounds trivia is preparing. Be ready...`), this.trivias[message.channel.id].start()]);
        await this.trivias[message.channel.id].sendQuestion();
      }
    }, {
      displayInHelp: true,
      helpMessage: 'Run a trivia game',
      dmAllowed: false,
      minArgs: 0,
      maxArgs: 4,
      usageMessage: '%c [rounds_number] [probability_of_illustrations] [probability_of_biography] [probability_of_ability]',
    });

    this.registerCommand('tanswer', async (message, commandName, args) => {
      if (this.trivias[message.channel.id] && this.trivias[message.channel.id].running) {
        const answer = args.join(' ');
        const result = this.trivias[message.channel.id].handleAnswer(message.author, answer);
        if (result) {
          await this.trivias[message.channel.id].displayScoreboard();
          if (this.trivias[message.channel.id].lastRound) {
            await this.trivias[message.channel.id].nextRound();
          } else {
            await message.channel.send(`Next question in 5 seconds... (round **${this.trivias[message.channel.id].publicRound + 1}**)`);
            setTimeout(async () => {
              await this.trivias[message.channel.id].nextRound();
            }, 5 * 1000);
          }
        }
      } else {
        message.reply('No trivia playing here...');
      }
    }, {
      displayInHelp: false,
      dmAllowed: false,
      minArgs: 1,
      usageMessage: '%c <answer>',
    });

    this.registerCommand('tstop', (message, commandName, args) => {
      if (this.trivias[message.channel.id]) {
        if (this.trivias[message.channel.id].running) {
          this.trivias[message.channel.id].stop();
          message.reply('Trivia successfully stopped.');
        } else {
          message.reply('Trivia already finished.');
        }
      } else {
        message.reply('No trivia playing here...');
      }
    }, {
      maxArgs: 0,
      displayInHelp: true,
      requiredPermission: Permissions.FLAGS.MANAGE_MESSAGES,
    });

    this.registerCommand('tscoreboard', async (message, commandName, args) => {
      if (this.trivias[message.channel.id]) {
        await this.trivias[message.channel.id].displayScoreBoard();
      } else {
        message.reply('No trivia was played here...');
      }
    });
  }

  _sliceMessage(message, chunkSize = 1500) {
    return message.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];
  }
}

module.exports = Zdrone;
