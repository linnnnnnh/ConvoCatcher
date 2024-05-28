require("dotenv").config();
const { REST, Routes, ApplicationCommandOptionType } = require("discord.js");

// Run node src/register-commands.js to register a new command!
const commands = [
  {
    name: "creative-process",
    description: "Timestamp your creative process",
  },
  {
    name: "final-work",
    description: "Timestamp your final artwork",
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Registrating (/) commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID, // The client ID of the bot
        process.env.GUILD_ID // The guild ID where the commands will be registered
      ),
      { body: commands }
    );
    console.log("Successfully registered (/) commands");
  } catch (error) {
    console.error(`There was an error: ${error}  `);
  }
})();
