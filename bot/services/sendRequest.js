const axios = require("axios");

const sendRequest = async (serverUrl, data) => {
  try {
    const response = await axios.post(serverUrl, data, {
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer", // Set the responseType to 'arraybuffer'
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error("Error fetching and sending the file:", error);
  }
};

module.exports = sendRequest;
