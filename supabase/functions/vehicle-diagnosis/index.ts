// Updated code to correctly parse confidence and add HTTP headers

import { SomeLibrary } from 'some-library';

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow access from any origin
    };

    const { data, confidence } = JSON.parse(event.body);

    // Process the confidence value
    if (confidence < 0.5) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: 'Low confidence level' }),
        };
    }

    // Business logic here

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Success' }),
    };
};