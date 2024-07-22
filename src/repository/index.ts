import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Bank } from "../domain/Bank";

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

export const getTransactionFromDynamoDb = async (transactionId: string) => {
  const { Items } = await dynamoDbClient.send(
    new ScanCommand({
      TableName: "TransactionsDbDev",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": transactionId,
      },
    })
  );

  if (!Items) {
    return [];
  }

  return Items[0] as any;
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

export const getBankFromLambda = async (bankId: string) => {
  if (bankId === "0") {
    return new Bank({
      id: "0",
      name: "Otros Bancos",
    });
  }

  const { Payload } = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: "BanksLambdaDev",
      Payload: JSON.stringify({
        resource: "/banks",
        httpMethod: "GET",
      }),
    })
  );
  const result = new Bank({});
  if (Payload) {
    const payload = JSON.parse(Buffer.from(Payload).toString());
    if (payload.statusCode === 200) {
      const body = JSON.parse(payload.body);
      const bankMatch = body.find((val: any) => val.id === bankId);

      if (!bankMatch) {
        throw new Error(`Bank with id ${bankId} not found`);
      }

      result.id = bankMatch.id;
      result.name = bankMatch.name;
      return result;
    }
  }
  return result;
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
