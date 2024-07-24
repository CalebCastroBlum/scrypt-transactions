import puppeteer from "puppeteer";
import {
  getTransactionFromDynamoDb,
  getCustomer,
  getFundFromDynamoDb,
  getBankFromLambda,
  getAccountFromLambda,
  getClientFromLambda,
  getTransactionByStartAndEndDate,
  makeCustomersCsv,
  makeCustomerPDF,
} from "./repository";

import { getDateAsString, getHourAsString, currency } from "./util";

import {
  createBuyTemplate,
  type createBuyTemplateType,
  createSellTemplate,
  type createSellTemplateType,
} from "./templates";
import { Customer, CustomerType } from "./domain/Customer";
import { Fund } from "./domain/Fund";
import { TransactionType } from "./domain/Transaction";
import { Bank } from "./domain/Bank";
import { Client } from "./domain/Client";
import { Account } from "./domain/Account";
import * as path from "path";
import * as fs from "fs";

// Tomar screenshot
const takeScreenshot = async (archive: string, html: string) => {
  const screenshotDir = path.resolve("./images");

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  await page.screenshot({
    path: path.join(screenshotDir, archive),
    fullPage: true,
  });

  await browser.close();
};

// Obtener datos desde la base de datos
const getData = async (
  transactionId: string
): Promise<{
  html: string;
  archive: string;
  data: createBuyTemplateType | createSellTemplateType;
}> => {
  const transaction = await getTransactionFromDynamoDb(transactionId);
  const customer = new Customer(await getCustomer(transaction.customerId));
  const fund = new Fund(await getFundFromDynamoDb(transaction?.fund.id));

  switch (customer.type) {
    case CustomerType.INDIVIDUAL: {
      if (transaction.type === TransactionType.BUY) {
        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          TRANSACTION_ID: transaction.origin.bank.transaction.id || "",
          BANK_NAME: new Bank(
            await getBankFromLambda(transaction.origin.bank.id)
          ).name,
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
        } as createBuyTemplateType;
        return {
          html: createBuyTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }

      if (transaction.type === TransactionType.SELL) {
        let account: Account;
        if (!transaction.clientId) {
          account = await getAccountFromLambda(
            transaction.destiny.account.id,
            customer
          );
        }

        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: transaction.subType,
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          ACCOUNT: transaction.clientId ? " - " : account.number,
          SHARES: "-",
          SETTLEMENT_DATE: getDateAsString(transaction.settlementDate),
          BANK_NAME: transaction.clientId
            ? new Client(await getClientFromLambda(transaction.clientId)).name
            : new Bank(await getBankFromLambda(account.bank.id)).name,
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
        } as createSellTemplateType;

        return {
          html: createSellTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }
      break;
    }
    case CustomerType.BUSINESS: {
      if (transaction.type === TransactionType.BUY) {
        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          TRANSACTION_ID: "",
          BANK_NAME: new Bank(
            await getBankFromLambda(transaction.origin.bank.id)
          ).name,
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
        } as createBuyTemplateType;

        return {
          html: createBuyTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }

      if (transaction.type === TransactionType.SELL) {
        const account = await getAccountFromLambda(
          transaction.destiny.account.id,
          customer
        );

        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: transaction.subType,
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          ACCOUNT: account.number,
          SETTLEMENT_DATE: "Pendiente de aprobación",
          BANK_NAME: new Bank(await getBankFromLambda(account.bank.id)).name,
          SHARES: "-",
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
        } as createSellTemplateType;
        return {
          html: createSellTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }
      break;
    }
    default: {
      throw new Error("Customer type not found");
    }
  }
};

const main = async ({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) => {
  // const transactions = await getTransactionByStartAndEndDate({
  //   startDate,
  //   endDate,
  // });

  const data = [
    {
      transactionId: "9228f0d1-d530-4bd9-8438-f566991b18a6",
    },
    {
      transactionId: "9352c49a-f397-408a-9a85-a8d99ae1e69d",
    },
    {
      transactionId: "989f7aef-1848-4e83-85b6-22bd5ad76b3e",
    },
    {
      transactionId: "9aa5bd95-dcb4-4f10-ad69-1bc2a98b21f6",
    },
  ];

  const transactions = await Promise.all(
    data.map(async (t) => {
      const response = await getTransactionFromDynamoDb(t.transactionId);
      return {
        ...response,
        transactionId: response.id,
        typeTransaction: response.type,
        customerId: response.customerId,
      };
    })
  );

  const transactionsWithData = await Promise.all(
    transactions.map(async (t) => {
      const { data, html, archive } = await getData(t.transactionId);
      await takeScreenshot(archive, html);
      return {
        ...t,
        ...data,
        archive,
        html,
        emailBlum: "Blum <noreply@miblum.com>",
      };
    })
  );

  await makeCustomersCsv({
    transactions: transactionsWithData,
    path: "output.csv",
  });

  await makeCustomerPDF({
    transactions: transactionsWithData,
    path: "output.pdf",
  });
  console.log("Done");
};

main({
  startDate: "2024-07-01",
  endDate: "2024-07-31",
});
