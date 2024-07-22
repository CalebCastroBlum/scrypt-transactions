import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const dynamoDbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: "us-east-2",
    // credentials: fromIni({
    //  profile: "admin",
    // }),
  })
);

const lambdaClient = new LambdaClient({
  region: "us-east-2",
  //credentials: fromIni({
  //  profile: "admin",
  // }),
});

export const getTransactionFromDynamoDb = async (
  transactionId: string,
  customerId: string
) => {
  const { Item } = await dynamoDbClient.send(
    new GetCommand({
      TableName: "TransactionsDbDev",
      Key: {
        id: transactionId,
        customerId: customerId,
      },
    })
  );

  return Item;
};

export const getFundFromDynamoDb = async (fundId: string) => {
  const { Item } = await dynamoDbClient.send(
    new GetCommand({
      TableName: "FundsDbDev",
      Key: {
        id: fundId,
      },
    })
  );

  return Item;
};

export const getCustomer = async (customerId: string) => {
  const { Payload } = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: `CustomersLambdaDev`,
      Payload: Buffer.from(
        JSON.stringify({
          httpMethod: "GET",
          resource: "/customers/{customerId}",
          pathParameters: {
            customerId: customerId,
          },
          queryStringParameters: {
            fullData: false,
          },
        })
      ),
    })
  );

  if (!Payload) {
    console.log(`Customer with id ${customerId} not found`);
    return "NOT FOUND";
  }

  const payload = JSON.parse(new TextDecoder().decode(Payload));

  const customer = JSON.parse(payload.body);

  return customer;
};
