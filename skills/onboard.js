module.exports = function(controller) {
  controller.hears(['onboard'], 'direct_message', function(bot, message) {
    getUser(message.user).then(user => {
      // user object can contain arbitary keys. we will store roles in .roles
      if (!user || !user.roles || user.roles.length == 0) {
        bot.reply(message, 'No roles have been created. Say `add _role_` to create one.');
      } else {
        bot.reply(message, 'Would you like to `add`, `edit`, or `view` a role?');
      }
    });
  });

  // listen for a user saying "add <something>", and then add it to the roles
  // store the new list in the storage system
  controller.hears(['add (.*)', 'add'], 'direct_message,direct_mention,mention', function(bot, message) {
    let newRole = message.match[1];
    if (!newRole) {
      createRole(bot, message);
      return;
    }
    getUser(message.user).then(user => {
      if (!user) {
        user = {};
        user.id = message.user;
        user.roles = [];
      }

      user.roles.push({ name: newRole, steps: [] });

      controller.storage.users.save(user, function(err, saved) {
        if (err) {
          bot.reply(message, 'I experienced an error creating the role: ' + err);
        } else {
          bot.api.reactions.add({
            name: 'thumbsup',
            channel: message.channel,
            timestamp: message.ts,
          });
        }
      });
    });
  });

  // listen for a user saying "edit <number>" and edit it.
  controller.hears(['edit (.*)', 'edit'], 'direct_message', function(bot, message) {
    let number = message.match[1];
    if (!number && number !== 0) {
      getUser(message.user).then(user => {
        let text;
        if (!user.roles.length) {
          text = 'No roles currently exist. Say `add _role_` to create one.';
        }
        text =
          'These are the existing roles: \n' +
          generateRoleList(user) +
          'Reply with `edit _number_` to modify the role.';

        bot.reply(message, text);
      });
      return;
    }

    if (isNaN(number)) {
      bot.reply(message, 'Please specify a number.');
    } else {
      // adjust for 0-based array index
      number = parseInt(number) - 1;

      getUser(message.user).then(user => {
        if (!user) {
          user = {};
          user.id = message.user;
          user.roles = [];
        }

        if (number < 0 || number >= user.roles.length) {
          bot.reply(message, 'Sorry, your input is out of range. Right now there are ' + user.roles.length + ' roles.');
        } else {
          bot.reply(message, `Sorry, I don't know how to do that yet.`);
        }
      });
    }
  });

  // listen for a user saying "view <number>" and edit it.
  controller.hears(['view (.*)', 'view'], 'direct_message', function(bot, message) {
    let number = message.match[1];
    if (!number && number !== 0) {
      getUser(message.user).then(user => {
        let text;
        if (!user.roles.length) {
          text = 'No roles currently exist. Say `add _role_` to create one.';
        }
        text =
          'These are the existing roles: \n' + generateRoleList(user) + 'Reply with `view _number_` to view the role.';

        bot.reply(message, text);
      });
      return;
    }

    if (isNaN(number)) {
      bot.reply(message, 'Please specify a number.');
    } else {
      // adjust for 0-based array index
      number = parseInt(number) - 1;

      getUser(message.user).then(user => {
        if (!user) {
          user = {};
          user.id = message.user;
          user.roles = [];
        }

        if (number < 0 || number >= user.roles.length) {
          bot.reply(message, 'Sorry, your input is out of range. Right now there are ' + user.roles.length + ' roles.');
        } else {
          bot.reply(message, generateRoleSteps(user.roles[number]));
        }
      });
    }
  });

  function createRole(bot, message) {
    let role = { name: '', steps: [] };
    bot.createConversation(message, function(err, convo) {
      convo.addQuestion(
        'What is the name of the role?',
        function(res, convo) {
          role.name = res.text;
          convo.gotoThread('should_add_step');
        },
        {},
        'root'
      );

      convo.addQuestion(
        'Would you like to add another step to the role?',
        [
          {
            pattern: bot.utterances.yes,
            callback: function(response, convo) {
              convo.gotoThread('yes_thread');
            },
          },
          {
            pattern: bot.utterances.no,
            callback: function(response, convo) {
              convo.gotoThread('no_thread');
            },
          },
          {
            default: true,
            callback: function(response, convo) {
              convo.gotoThread('bad_response');
            },
          },
        ],
        {},
        'should_add_step'
      );

      convo.addQuestion(
        'What is the step?',
        function(res, convo) {
          role.steps.push(res.text);
          convo.gotoThread('should_add_step');
        },
        {},
        'yes_thread'
      );

      // mark the conversation as unsuccessful at the end
      convo.addMessage('Okay, your role has been created.', 'no_thread');

      // create a path where neither option was matched
      // this message has an action field, which directs botkit to go back to the `default` thread after sending this message.
      convo.addMessage(
        {
          text: 'Sorry I did not understand. Say `yes` or `no`',
          action: 'default',
        },
        'bad_response'
      );

      convo.activate();
      convo.gotoThread('root');

      // capture the results of the conversation and see what happened...
      convo.on('end', function(convo) {
        if (convo.successful()) {
          getUser(message.user).then(user => {
            if (!user) {
              user = {};
              user.id = message.user;
              user.roles = [];
            }

            user.roles.push(role);
            controller.storage.users.save(user, function(err, saved) {
              if (err) {
                bot.reply(message, 'I experienced an error creating the role: ' + err);
              } else {
                bot.reply(message, 'Saved');
              }
            });
          });
        }
      });
    });
  }

  function getUser(user) {
    return new Promise((resolve, reject) => {
      controller.storage.users.get(user, function(err, user) {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      });
    });
  }

  // simple function to generate the text of the role list so that
  // it can be used in letious places
  function generateRoleList(user) {
    let text = '';

    for (let t = 0; t < user.roles.length; t++) {
      text = text + '> `' + (t + 1) + '`) ' + user.roles[t].name + '\n';
    }

    return text;
  }

  // simple function to generate the role steps
  // it can be used in letious places
  function generateRoleSteps(role) {
    let text = `Role: ${role.name}\n`;

    for (let t = 0; t < role.steps.length; t++) {
      text = text + '> `' + (t + 1) + '`) ' + role.steps[t] + '\n';
    }

    return text;
  }
};
