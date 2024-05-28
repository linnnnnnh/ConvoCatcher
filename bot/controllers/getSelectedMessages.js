const getMessages = require("./getMessages");

// Getting guild ID, channel ID, timestamps, prompts and image urls
const fetchSelectedMessages = async (client, interaction) => {
  const allMessages = await getMessages(client, interaction);

  const promptsAndUrls = [];

  // Iterate through the messages in chronological order: oldest to newest
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];

    if (i === allMessages.length - 1) {
      promptsAndUrls.push(`Server ID: ${msg.guildId}`);
      promptsAndUrls.push(`Channel ID: ${msg.channelId}`);
    }

    // Add the timestamp
    promptsAndUrls.push(msg.createdTimestamp);

    // Add the message content to the array
    promptsAndUrls.push(`Prompt: ${msg.content}`);

    // Check if there are attachments and add the URL to the array
    if (msg.attachments.size > 0) {
      const url = msg.attachments.first().url;
      promptsAndUrls.push(url);
    }
  }

  // console.dir(promptsAndUrls, { maxArrayLength: null });

  return promptsAndUrls;
};

module.exports = fetchSelectedMessages;
