const { app } = require('@azure/functions');
const { AzureFunction, Context } = require('@azure/functions');
const { ServiceBusClient } = require('@azure/service-bus');

const serviceBusClient = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION_STRING);
const sender = serviceBusClient.createSender(process.env.SERVICE_BUS_TOPIC_NAME);

async function sendToServiceBusWithDelay(personData, delayInMilliseconds) {
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const message = {
                    body: JSON.stringify(personData),
                    label: 'PersonData'
                };
                await sender.sendMessages(message);
                console.log('Message sent to Service Bus');
                resolve();
            } catch (error) {
                console.error('Error sending message to Service Bus:', error);
                reject(error);
            }
        }, delayInMilliseconds);
    });
}

app.storageBlob('storageBlobTrigger', {
    path: 'rawdatatest',
    handler: async (blob) => {
        const blobContent = blob.toString('utf8').replace(/\n/g, '');
        const peopleData = JSON.parse(blobContent);
        const delayInMilliseconds = 5000; // 5 seconds delay
        for (const person of peopleData) {
            console.log('Sending person to Service Bus with delay...');
            await sendToServiceBusWithDelay(person, delayInMilliseconds);
        }
    }
});