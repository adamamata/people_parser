const { app } = require('@azure/functions');
const { AzureFunction, Context } = require('@azure/functions');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');

dotenv.config();

// Prompt
const promptTemplate = fs.readFileSync('./src/prompts/final_prompt.txt', 'utf8');

// Cosmos
const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const databaseId = 'Items';
const containerId = 'Items';

const openai = new OpenAI({
    apiKey: process.env.APIKEY
});

function generateUniqueId() {
    return uuidv4();
}

async function callGPTAPI(data) {
    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: [{ role: 'system', content: `${promptTemplate} Resume data: ${data}` }],
    });
    return response.choices[0].message.content.trim();
}

async function processPersonData(personData, retryCount = 3) {
    try {
        const uniqueId = generateUniqueId();
        const structuredData = await callGPTAPI(personData);
        const item = { id: uniqueId, data: JSON.parse(structuredData), imported: false, created: new Date().toISOString(), rawData: personData };
        console.log(item);
        await uploadToCosmosDB(item);
        console.log('Item added to Cosmos DB successfully');
    } catch (error) {
        console.error('Error processing person data:', error);
        if (retryCount > 0) {
            const delayInSeconds = 10; 
            console.log(`Retrying (${retryCount} attempts left) after ${delayInSeconds} seconds`);
            await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000)); 
            await processPersonData(personData, retryCount - 1);
        } else {
            console.error('Retry limit reached. Skipping this item.');
        }
    }
}

async function uploadToCosmosDB(item) {
    try {
        const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
        const { container } = await database.containers.createIfNotExists({ id: containerId });
        await container.items.create(item);
        console.log('Item uploaded to Cosmos DB:', item);
    } catch (error) {
        console.error('Error uploading item to Cosmos DB:', error);
    }
}

app.serviceBusTopic('serviceBusTopicTrigger', {
    connection: 'SERVICE_BUS_CONNECTION_STRING',
    topicName: process.env.SERVICE_BUS_TOPIC_NAME,
    subscriptionName: process.env.SERVICE_BUS_SUBSCRIPTION_NAME,
    handler: async (message) => {
        console.log('Processing person data...');
        const jsonString = JSON.stringify(message);
        await processPersonData(jsonString);
    }
});