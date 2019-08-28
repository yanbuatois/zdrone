const _ = require('underscore');

/**
 * @typedef {Object} Question Trivia question
 * @property {String} text Question text
 * @property {String} [picture] Picture URL (if existing)
 */

class Trivia {
  constructor({
    channel,
    discordClient,
    rounds = 0,
    illustrationRate = 33,
    biographyRate = 33,
    abilityRate = 33,
  }) {
    if (!['dm', 'group', 'text'].includes(channel.type)) {
      throw new Error('The channel is not valid.');
    }
    this.channel = channel;
    this.rounds = Number(rounds);
    this.discordClient = discordClient;
    this.illustrationRate = Number(illustrationRate);
    this.biographyRate = Number(biographyRate);
    this.abilityRate = Number(abilityRate);

    if (this.rounds === 0) {
      throw new Error('You cannot create a trivia with 0 round.');
    }

    this.round = -1;
    this.scoreBoard = {};
    this.questions = [];
    this.responses = [];
    this.running = true;
    this.type = '';
    this.roundPlaying = false;

    this.availableCharacters = [];
    this.uniqueAbilityCharacters = [];
  }

  start() {
    return Promise.all(_.times(this.rounds, () => this.generateNewQuestion()));
  }

  sendQuestion() {
    return this.channel.send(this.questions[this.round].text, (this.questions[this.round].picture) ? {
      files: [{
        attachment: this.questions[this.round].picture,
        name: 'unknown.png',
      }],
    } : undefined);
  }

  async getAvailableCharacters() {
    if (!this.availableCharacters.length) {
      const { items: charas } = await this.discordClient.urApi.query("characters.getCharacters", { sortby: 'clan', maxLevels: true }, {
        itemsFilter: ['name','id','url','level','rarity','ability','characterPictUrl','characterNewPictUrl','description', 'level_max', 'level_min'],
      });
      this.availableCharacters = charas;
    }
    return this.availableCharacters;
  }

  async getUniqueAbilityCharacters() {
    if (!this.uniqueAbilityCharacters.length) {
      const charas = await this.getAvailableCharacters();
      const pouvoirsComptes = _.countBy(charas, (char) => char.ability);
      const pouvoirsUniques = _.keys(_.pick(pouvoirsComptes, (value) => value === 1));
      const persosPouvoirsUniques = _.filter(charas, (item) => pouvoirsUniques.includes(item.ability));

      this.uniqueAbilityCharacters = persosPouvoirsUniques;
    }

    return this.uniqueAbilityCharacters;
  }

  async generateNewQuestion({
    illustrationRate = this.illustrationRate,
    biographyRate = this.biographyRate,
    abilityRate = this.abilityRate,
  } = {}) {

    let question, response;
    const { urApi } = this.discordClient;
    const choice = Math.random() * Math.floor(Number(illustrationRate) + Number(biographyRate) + Number(abilityRate));

    const charas = await this.getAvailableCharacters();

    if (choice < illustrationRate) {
      // Illu
      this.type = 'illustration';
      // const { id } = charas[Math.floor(Math.random()*charas.length)];
      const rCha = charas[Math.floor(Math.random()*charas.length)];
      const { id, level_max, level_min } = rCha;
      const randLevelNb = Math.round(Math.random()*(level_max - level_min)) + level_min;
      console.log(`${level_min}:${randLevelNb}:${level_max}`);
      const level = (await urApi.query('characters.getCharacterLevels', {
        characterID: id,
        levelMax: randLevelNb,
        imageSize: 'large',
      }, {
        itemsFilter: ['characterHDBigPictURL', 'name', 'id', 'level', 'level_min', 'level_max', 'url'],
      })).items;
      const randLevel = level[level.length - 1];
      const url = randLevel.characterHDBigPictURL;
      question = {
        text: 'Which character has this illustration ?',
        picture: url,
      };
      response = {
        text: randLevel.name,
        character: randLevel,
      };
    } else if (choice < Number(illustrationRate) + Number(biographyRate)) {
      this.type = 'biography';
      // Bio
      const randomChara = charas[Math.floor(Math.random()*charas.length)];
      const miniName = (['cr','m','l']).includes(randomChara.rarity) ? randomChara.name.slice(0, -3) : randomChara.name;
      const nameRegex = new RegExp(`${miniName}( (Cr|Mt|Ld))?`, 'g');
      question = {
        text: `Which character has the following biography ?\n> ${randomChara.description.replace(/\n/g, '\n> ').replace(nameRegex, '???')}`
      };
      response = {
        text: randomChara.name,
        character: randomChara,
      };
    } else {
      this.type = 'ability';

      const persosPouvoirsUniques = await this.getUniqueAbilityCharacters();
      const randomChara = persosPouvoirsUniques[Math.floor(Math.random()*persosPouvoirsUniques.length)];
      question = {
        text: `Which character has the following ability ?\n> ${randomChara.ability}`,
      };
      response = {
        text: randomChara.name,
        character: randomChara,
      };
      // Pouvoir unique
    }

    this.questions.push(question);
    this.responses.push(response);
    return question;
  }

  increasePlayerScore(playerId) {
    if (this.scoreBoard[playerId]) {
      ++this.scoreBoard[playerId];
    } else {
      this.scoreBoard[playerId] = 1;
    }
  }

  increaseRound() {
    ++this.round;
  }

  _nextRound() {
    this.increaseRound();
    this.roundPlaying = true;
    return this.questions[this.round];
  }

  async nextRound() {
    if (this.lastRound) {
      const [winnerId] = this.getScorePlayerIds();
      let message = 'The trivia is over.';
      if (winnerId) {
        const winner = await this.discordClient.fetchUser(winnerId);
        message += `\n**${winner.username}** won the trivia with **${this.scoreBoard[winnerId]}** points. Congratulations.`;
      } else {
        message += `\nNo player has scored any points during this trivia.`;
      }
      this.stop();
      return this.channel.send(message);
    } else {
      this._nextRound();
      return this.sendQuestion();
    }
  }

  handleAnswer(player, answer) {
    if (this.roundPlaying) {
      const response = this.responses[this.round];
      const result = answer.toLowerCase() === response.text.toLowerCase();

      if (result) {
        this.increasePlayerScore(player.id);
        this.channel.send(`:thumbsup: You're right! The character was **${response.text}**!\n${player.username} won **1** point. His score is now ${this.scoreBoard[player.id]}!\nhttps://www.urban-rivals.com${response.character.url}`);
        this.roundPlaying = false;
      } else {
        this.channel.send(`:frowning: Bad answer... Try again!`);
      }
      return result;
    } else {
      this.channel.send(this.round === -1 ? 'The game hasn\'t started yet :wink:' : 'The round has ended, be quicker next time :confused:');
      return false;
    }

    return false;
  }

  async displayScoreboard() {
    const playerIds = this.getScorePlayerIds();
    let finalMessage = '';
    if (!playerIds.length) {
      finalMessage = 'No player has scored any point so far.';
    } else {
      const players = await Promise.all(playerIds.map(id => this.discordClient.fetchUser(id)));
      finalMessage = '**SCOREBOARD:**\n';
      let index = 1;
      for (const player of players) {
        const score = this.scoreBoard[player.id];
        finalMessage += `**${index}**: **${player.username}** (**${score}** point${score > 1 ? 's' : ''})\n`;
        ++index;
      }
    }

    return this.channel.send(finalMessage);
  }

  getScorePlayerIds() {
    const playerIds = _.keys(this.scoreBoard);
    playerIds.sort((a, b) => this.scoreBoard[b]- this.scoreBoard[a]);
    return playerIds;
  }

  stop() {
    this.running = false;
  }

  get publicRound() {
    return this.round + 1;
  }

  get lastRound() {
    return this.round + 1 >= this.rounds;
  }
}

module.exports = Trivia;
