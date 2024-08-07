import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { fromIni } from "@aws-sdk/credential-providers";
import { Bank } from "../domain/Bank";
import { Customer } from "../domain/Customer";
import { Account } from "../domain/Account";
import { Client } from "../domain/Client";
import { createObjectCsvWriter } from "csv-writer";
import * as PDFDocument from "pdfkit";
import * as fs from "fs";
import { ENV } from "../index";
import axios from "axios";
import { TransactionTypeName } from "../util";

const dynamoDbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: "us-east-2",
    credentials: fromIni({
      profile: "admin",
    }),
  })
);

const lambdaClient = new LambdaClient({
  region: "us-east-2",
  credentials: fromIni({
    profile: "admin",
  }),
});

export const getPivoltTransaction = async (transactionId: string) => {
  const { Item } = await dynamoDbClient.send(
    new GetCommand({
      TableName: `PivoltTransactionsDb${ENV}`,
      Key: {
        transactionId,
      },
    })
  );

  return Item || {};
};

export const getPivoltApiTransaction = async (transactionId: string) => {
  const {
    data,
  }: {
    data: {
      Results: {
        TransactionId: string;
        Amount: number;
        Price: number;
        Tax2: number;
        Quantity: number;
        TransactionTypeDetail: string;
      }[];
    };
  } = await axios.get(
    `https://salkantay.pivolt.com//api/transaction/get?TransactionId=${transactionId}`,
    {
      headers: {
        Authorization: `Basic cG9ydGFsOno1SGtESkBXNDR+akpySk1ANXY1`,
      },
    }
  );

  const [result] = data.Results ?? [];

  if (result) {
    return {
      pivolt: { transactionId: result.TransactionId },
      TransactionTypeDetail: result.TransactionTypeDetail,
    };
  }

  return null;
};

export const getTransactionDb = async ({
  customerId,
  transactionId,
}: {
  transactionId: string;
  customerId: string;
}) => {
  console.log({ transactionId });
  const { Item } = await dynamoDbClient.send(
    new GetCommand({
      TableName: `TransactionsDb${ENV}`,
      Key: {
        id: transactionId,
        customerId,
      },
    })
  );

  return Item as any;
};

export const getTransactionFromDynamoDb = async (transactionId: string) => {
  try {
    console.log({ transactionId });
    const { Items } = await dynamoDbClient.send(
      new ScanCommand({
        TableName: `TransactionsDb${ENV}`,
        ExpressionAttributeValues: {
          ":id": transactionId,
        },
        FilterExpression: "id = :id",
      })
    );
    console.log({ Items });

    if (!Items) {
      return [];
    }

    return Items[0] as any;
  } catch (error) {
    console.log({ error });
  }
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
  const response = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const { Items, LastEvaluatedKey } = await dynamoDbClient.send(
      new ScanCommand({
        TableName: `TransactionsDb${ENV}`,
        FilterExpression: `creationDate BETWEEN :startDate AND :endDate AND (#fund.#id = :fundId1 OR #fund.#id = :fundId2 OR #fund.#id = :fundId3 OR #fund.#id = :fundId4)`,
        ExpressionAttributeNames: {
          "#fund": "fund",
          "#id": "id",
        },
        ExpressionAttributeValues: {
          ":startDate": startDateNumber,
          ":endDate": endDateNumber,
          ":fundId1": "globalCash",
          ":fundId2": "globalGrowth",
          ":fundId3": "globalCapital",
          ":fundId4": "globalCashPEN",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (Items && Items.length > 0) {
      response.push(
        ...Items.map((item) => ({
          ...item,
          transactionId: item.id,
          typeTransaction: item.type,
          customerId: item.customerId,
        }))
      );
    }

    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return response.sort((a, b) => b.creationDate - a.creationDate);
};

export const getFundFromDynamoDb = async (fundId: string) => {
  const { Item } = await dynamoDbClient.send(
    new GetCommand({
      TableName: `FundsDb${ENV}`,
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
      FunctionName: `BanksLambda${ENV}`,
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
      FunctionName: `AccountsLambda${ENV}`,
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
      FunctionName: `SecurityLambda${ENV}`,
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
      FunctionName: `CustomersLambda${ENV}`,
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

export const getEmployee = async ({
  employeeId,
  customerId,
}: {
  employeeId: string;
  customerId: string;
}) => {
  const { Item } = await dynamoDbClient.send(
    new GetCommand({
      TableName: `EmployeesDb${ENV}`,
      Key: {
        id: employeeId,
        customerId: customerId,
      },
    })
  );

  if (!Item) {
    throw new Error("Employee not found");
  }

  return {
    id: Item.id,
    name: Item.name,
    middleName: Item.middleName,
    lastName: Item.lastName,
    motherLastName: Item.motherLastName,
  };
};

export const makeCustomersCsv = async ({
  transactions,
  path,
}: {
  transactions: any;
  path: string;
}) => {
  const csvWriter = createObjectCsvWriter({
    path,
    header: [
      { id: "transactionId", title: "Transaction Id" },
      { id: "typeTransaction", title: "Transaction Type" },
      { id: "customerId", title: "Customer Id" },
      { id: "nombre", title: "Customer Name" },
      { id: "type", title: "Customer Type" },
      { id: "email", title: "Correo Electrónico" },
      { id: "document_type", title: "Tipo Documento" },
      { id: "document_number", title: "Número Documento" },
      { id: "archive", title: "Archivo" },
    ],
  });

  const records = transactions.map((t: any) => ({
    transactionId: t.transactionId,
    typeTransaction: `${t.typeTransaction} ${t.SUBTYPE ?? ""}`,
    customerId: t.customerId,
    nombre: t.FULL_NAME,
    type: t.CUSTOMER_TYPE,
    email: t.EMAIL,
    document_type: t.DOCUMENT_TYPE,
    document_number: t.DOCUMENT_NUMBER,
    archive: t.archive,
  }));

  csvWriter.writeRecords(records);
};

export const makeCustomerPDF = async ({
  transactions,
  path,
}: {
  transactions: any;
  path: string;
}) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(fs.createWriteStream(path));

  transactions.forEach((t: any) => {
    const imagePath = `images/${t.archive}`;
    let sharesOrAmount = "";
    if (t.isRescueByAmount) {
      sharesOrAmount = "por Monto";
    } else if (t.isRescueByShares) {
      sharesOrAmount = "por Cuotas";
    }

    if (fs.existsSync(imagePath)) {
      doc.fontSize(14);
      doc.text(`${t.DOCUMENT_TYPE} ${t.DOCUMENT_NUMBER}`, 50, 30);
      doc.text(`${t.FULL_NAME}`, 50, 50);
      doc.fontSize(9);
      doc.text(`TransactionId: ${t.transactionId}`, 50, 90);
      doc.text(
        `Tipo de transacción: ${TransactionTypeName[t.typeTransaction]} ${
          t.SUBTYPE ?? ""
        } ${t.SUBTYPE === "Parcial" ? sharesOrAmount : ""}`,
        50,
        110
      );
      doc.text(`Status transacción: ${t.STATUS}`, 50, 130);
      doc
        .image(imagePath, 50, 250, { width: 500 })
        .text(`Asunto: ${t.SUBJECT}`, 50, 150)
        .text(`Para: ${t.EMAIL}`, 50, 170)
        .text(`De: ${t.emailBlum}`, 50, 190)
        .text(`Fecha (mes/día/año): ${t.DATE} ${t.HOUR ?? t.TIME}`, 50, 210)
        .text(`CustomerId: ${t.customerId}`, 50, 230);
      doc.addPage();
    }
  });

  console.log("INFO", "makeCustomerPDF");

  doc.end();
};
