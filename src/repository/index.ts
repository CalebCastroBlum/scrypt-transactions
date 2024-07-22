import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
// import { fromIni } from "@aws-sdk/credential-providers";
import { Bank } from "../domain/Bank";
import { Customer } from "../domain/Customer";
import { Account } from "../domain/Account";
import { Client } from "../domain/Client";
// import { promises as fs } from "fs";

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

export const getTransactionByStartAndEndDate = async ({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) => {
  const startDateNumber = new Date(startDate).getTime();
  const endDateNumber = new Date(endDate).getTime();

  const { Items, LastEvaluatedKey } = await dynamoDbClient.send(
    new ScanCommand({
      TableName: "TransactionsDbDev",
      FilterExpression: "creationDate BETWEEN :startDate and :endDate",
      ExpressionAttributeValues: {
        ":startDate": startDateNumber,
        ":endDate": endDateNumber,
      },
      /* ExclusiveStartKey: lastEvaluatedKey, */
    })
  );

  if (!Items) {
    return [];
  }

  return Items.map((item) => ({
    id: item.id,
  }));
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

export const getAccountFromLambda = async (
  accountId: string,
  customer: Customer
) => {
  const { Payload } = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: "AccountsLambdaDev",
      Payload: JSON.stringify({
        resource: "/customers/{customerId}/accounts/{accountId}",
        httpMethod: "GET",
        pathParameters: {
          accountId: accountId,
          customerId: customer.id,
        },
        queryStringParameters: {
          customerType: customer.type,
        },
      }),
    })
  );

  if (Payload) {
    const payload = JSON.parse(Buffer.from(Payload).toString());
    if (payload.statusCode === 200) {
      const body = JSON.parse(payload.body);
      const result = new Account(body);
      return result;
    }
  }

  throw new Error(`Account with id ${accountId} not found`);
};

export const getClientFromLambda = async (clientId: string) => {
  const { Payload } = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: "SecurityLambdaDev",
      Payload: JSON.stringify({
        httpMethod: "GET",
        resource: "/clients/{clientId}",
        pathParameters: {
          clientId,
        },
      }),
    })
  );

  if (Payload) {
    const payload = JSON.parse(Buffer.from(Payload).toString());
    if (payload.statusCode === 200) {
      const body = JSON.parse(payload.body);
      return new Client({
        id: body.id,
        name: body.name,
      });
    }
  }
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

// export const makeCustomersCsv = async ({
//   customers,
//   path,
// }: {
//   customers: Customer[];
//   path: string;
// }) => {
//   const headers = [
//     "Blum Customer Id",
//     "Usuario",
//     "Documento de identidad",
//     "Tipo de usuario",
//     "Perfil de Riesgo",
//     "Status",
//   ];

//   const csvContent = customers.map((t) => [
//     // t.id,
//     // `${t.name || ""} ${t.middleName || ""} ${t.lastName || ""} ${
//     //   t.motherLastName || ""
//     // }`,
//     // `${t?.identityDocuments?.[0]?.type || ""} ${
//     //   t.identityDocuments?.[0]?.number || ""
//     // }`,
//     // t.type === "INDIVIDUAL" ? "Natural" : "Jurídico",
//     // t.riskProfile,
//     // t.status,
//   ]);

//   await fs.writeFile(
//     path,
//     encode1252([headers, ...csvContent].map((row) => row.join(",")).join("\n")),
//     { encoding: "binary" }
//   );
//   /* console.log(OK, "Customers report generated"); */
// };
