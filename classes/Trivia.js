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
    this.rounds = rounds;
    this.discordClient = discordClient;
    this.illustrationRate = illustrationRate;
    this.biographyRate = biographyRate;
    this.abilityRate = abilityRate;

    if (this.rounds === 0) {
      throw new Error('You cannot create a trivia with 0 round.');
    }

    this.round = 0;
    this.scoreBoard = {};
    this.questions = [];
    this.responses = [];
    this.running = true;
    this.type = '';
  }

  start() {
    return Promise.all(_.times(this.rounds, () => this.generateNewQuestion()));
  }

  sendQuestion() {
    console.log(this.questions[this.round].picture);
    return this.channel.send(this.questions[this.round].text, (this.questions[this.round].picture) ? {
      files: [{
        attachment: this.questions[this.round].picture,
        name: 'unknown.png',
      }],
    } : undefined);
  }

  async generateNewQuestion({
    illustrationRate = this.illustrationRate,
    biographyRate = this.biographyRate,
    abilityRate = this.abilityRate,
  } = {}) {

    let question, response;
    const { urApi } = this.discordClient;
    const choice = Math.random() * Math.floor(Number(illustrationRate) + Number(biographyRate) + Number(abilityRate));

    console.log('started');
    const { items: charas } = await urApi.query("characters.getCharacters", { sortby: 'clan', maxLevels: true });
    if (choice < illustrationRate) {
      // Illu
      this.type = 'illustration';
      const { id } = charas[Math.floor(Math.random()*charas.length)];
      const level = (await urApi.query('characters.getCharacterLevels', {
        characterID: id,
        levelMax: -1,
        imageSize: 'large',
      })).items;
      const randLevel = level[Math.floor(Math.random()*level.length)];
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
        text: `Which character has the following biography ?\n> ${randomChara.description.replace('\n', '\n> ').replace(nameRegex, '???')}`
      };
      response = {
        text: randomChara.name,
        character: randomChara,
      };
    } else {
      this.type = 'ability';
      const { items } = await urApi.query("characters.getCharacters", { maxLevels: true });
      const pouvoirsComptes = _.countBy(items, (char) => char.ability);
      const pouvoirsUniques = _.keys(_.pick(pouvoirsComptes, (value) => value === 1));
      const persosPouvoirsUniques = _.filter(items, (item) => pouvoirsUniques.includes(item.ability));
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
    console.log(question);
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
    const response = this.responses[this.round];
    const result = answer.toLowerCase() === response.text.toLowerCase();

    if (result) {
      this.increasePlayerScore(player.id);
      this.channel.send(`:thumbsup: You're right! The character was **${response.text}**!\n${player.username} won **1** point. His score is now ${this.scoreBoard[player.id]}!\nhttps://www.urban-rivals.com${response.character.url}`);
    } else {
      this.channel.send(`:frowning: Bad answer... Try again!`);
    }

    return result;
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
