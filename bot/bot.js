require("dotenv").config();
const {
  Client,
  IntentsBitField,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} = require("discord.js");
const axios = require("axios");
const wait = require("node:timers/promises").setTimeout;
const getMessages = require("./controllers/getMessages");
const getSelectedMessages = require("./controllers/getSelectedMessages");
const sendRequest = require("./services/sendRequest");
const { ImageAlignment } = require("pdf-lib");

// Create a new client instance, the client is our bot instance
// The intents are the events that the bot is authorized to listen to
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.on("ready", (c) => {
  console.log(`✅ Logged in as ${c.user.tag}!`);
});

// Save and creative-process slash command
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "creative-process") {
    await interaction.deferReply();
    const promptsAndUrls = await getSelectedMessages(client, interaction);

    // send channel conversation to the serer side
    if (promptsAndUrls.length > 0) {
      let payload = promptsAndUrls.map((content) => {
        if (typeof content === "string" && content.startsWith("Server")) {
          return { type: "serverId", text: content };
        } else if (
          typeof content === "string" &&
          content.startsWith("Channel")
        ) {
          return { type: "channelId", text: content };
        } else if (
          typeof content === "string" &&
          content.startsWith("Prompt")
        ) {
          return { type: "prompt", text: content };
        } else if (typeof content === "string" && content.startsWith("http")) {
          return { type: "image", url: content };
        } else if (typeof content === "number") {
          return { type: "time", text: content };
        } else {
          return { type: "unkown", text: content };
        }
      });

      const serverUrl = "http://localhost:3000/creative-process";

      const data = { promptsAndUrls: payload };

      // Send the conversation content to the server
      const responseData = await sendRequest(serverUrl, data);

      const blob = new Blob([responseData], { type: "application/zip" });
      const buffer = await blob.arrayBuffer();
      const attachment = new AttachmentBuilder(Buffer.from(buffer), {
        name: "creative-process.zip",
        description:
          "Your Creative Process and Timestamping Certificate are here, please download them.",
      });
      await wait(15_000);
      await interaction.editReply({
        content:
          "Your Creative Process and Timestamping Certificate are here, please download them.",
        files: [attachment],
      });
    }
  }
});

let urls = [];

// Slash command to select the final work
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "final-work") {
    await interaction.deferReply();

    const allMessages = await getMessages(client, interaction);

    let finalWorkUrls = [];

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];

      for (const component of msg.components) {
        for (const buttonComponent of component.components) {
          if (buttonComponent.data.label === "Web") {
            const url = msg.attachments.first().url;
            finalWorkUrls.push(url);
          }
        }
      }
    }

    const imagesUrls = finalWorkUrls.map((url, index) => {
      const id = `image${index + 1}`;
      const label = `Image candidate ${index + 1}`;
      return { url, id, label };
    });

    urls = imagesUrls;

    for (const image of imagesUrls) {
      const button = new ButtonBuilder()
        .setCustomId(image.id)
        .setLabel(image.label)
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      const embed = new EmbedBuilder().setTitle(image.id).setImage(image.url);

      await interaction.followUp({
        embeds: [embed],
        components: [row],
      });

      await interaction.editReply(
        "Please select one image as the final work by clicking the corresponding button."
      );
    }
  }
});

// Handle button interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const image = urls.find((url) => url.id === interaction.customId);

  if (image) {
    const embed = new EmbedBuilder()
      .setTitle("Selected Image")
      .setImage(image.url);

    await interaction.update({
      content: "Here is your selected image:",
      embeds: [embed],
      components: [],
    });

    const serverUrl = "http://localhost:3000/final-work";

    const data = { type: "image", imageUrl: image.url };
    const responseData = await sendRequest(serverUrl, data);

    const blob = new Blob([responseData], { type: "application/pdf" });
    const buffer = await blob.arrayBuffer();
    const attachment = new AttachmentBuilder(Buffer.from(buffer), {
      name: "final-work.pdf",
      description: "Final work certificate",
    });

    await interaction.followUp({
      content:
        "The timestamping certificate of your final work is here, please download it.",
      files: [attachment],
    });
  } else {
    await interaction.update({ content: "Invalid selection!", components: [] });
  }
});

client.login(process.env.TOKEN);
