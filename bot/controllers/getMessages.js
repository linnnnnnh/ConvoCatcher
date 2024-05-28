const fetchMessages = async (client, interaction) => {
  const channel = client.channels.cache.get(interaction.channelId);

  let allMessages = [];

  // Create message pointer
  let message = await channel.messages
    .fetch({ limit: 1 })
    .then((messagePage) => (messagePage.size === 1 ? messagePage.at(0) : null));

  while (message) {
    await channel.messages
      .fetch({ limit: 100, before: message.id })
      .then((messagePage) => {
        messagePage.forEach((msg) => allMessages.push(msg));

        // Update our message pointer to be the last message on the page of allMessages
        message =
          0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
      });
  }
  // console.log("all messages", allMessages);

  return allMessages;
};

module.exports = fetchMessages;
