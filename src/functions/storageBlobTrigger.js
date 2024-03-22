// const { app } = require('@azure/functions');
// const { BlobServiceClient } = require('@azure/storage-blob');
// const OpenAI = require('openai');
// const dotenv = require('dotenv');
// const { v4: uuidv4 } = require('uuid');
// const fs = require('fs');
// const { CosmosClient } = require('@azure/cosmos');

// dotenv.config();

// //Prompt
// const promptTemplate = fs.readFileSync('./src/prompts/final_prompt.txt', 'utf8');

// //CosmosDB
// const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
// const databaseId = 'Items';
// const containerId = 'Items';

// const openai = new OpenAI({
//     apiKey: process.env.APIKEY
// });

// function generateUniqueId() {
//     return uuidv4();
// }

// async function callGPTAPI(data) {
//     const response = await openai.chat.completions.create({
//         model: 'gpt-3.5-turbo-0125',
//         messages: [{ role: 'system', content: `${promptTemplate} Resume data: ${JSON.stringify(data)}` }],
//     });
//     return response.choices[0].message.content.trim();
// }

// async function processPersonData(personData) {
//     try {
//         const uniqueId = generateUniqueId();
//         const structuredData = await callGPTAPI(personData);
//         const item = { id: uniqueId, data: JSON.parse(structuredData) };
//         await uploadToCosmosDB(item);
//         console.log('Item added successfully');
//     } catch (error) {
//         console.error('Error processing person data:', error);
//     }
// }

// async function uploadToCosmosDB(item) {
//     const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
//     const { container } = await database.containers.createIfNotExists({ id: containerId });
//     await container.items.create(item);
// }

// app.storageBlob('storageBlobTrigger', {
//     path: 'rawdatatest',
//     handler: async (blob) => {
//         const blobContent = blob.toString('utf8').replace(/\n/g, '');
//         const peopleData = JSON.parse(blobContent);
//         for (const person of peopleData) {
//             await processPersonData(person);
//         }
//     }
// });

const { app } = require('@azure/functions');
const { AzureFunction, Context } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');
const fs = require('fs');

const serviceBusClient = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION_STRING);
const sender = serviceBusClient.createSender(process.env.SERVICE_BUS_QUEUE_NAME);

async function sendToServiceBus(personData) {
    try {
        const message = {
            body: JSON.stringify(personData),
            label: 'PersonData',
        };
        await sender.sendMessages(message);
        console.log('Message sent to Service Bus:', message.body);
    } catch (error) {
        console.error('Error sending message to Service Bus:', error);
    }
}

app.storageBlob('storageBlobTrigger', {
    path: 'rawdatatest',
    handler: async (blob) => {
        const blobContent = blob.toString('utf8').replace(/\n/g, '');
        const peopleData = JSON.parse(blobContent);
        for (const person of peopleData) {
            await sendToServiceBus(person);
        }
    }
});