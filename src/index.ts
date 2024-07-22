import puppeteer from "puppeteer";
import {
  getTransactionFromDynamoDb,
  getCustomer,
  getFundFromDynamoDb,
  getBankFromLambda,
  getAccountFromLambda,
  getClientFromLambda,
  getTransactionByStartAndEndDate,
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
const takeScreenshot = async (name: string, html: string) => {
  const screenshotDir = path.resolve("./images");

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  await page.screenshot({
    path: path.join(screenshotDir, name + ".png"),
    fullPage: true,
  });

  await browser.close();
};

// Obtener datos desde la base de datos
const getData = async (
  transactionId: string
): Promise<{ html: string; name: string }> => {
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
        } as createBuyTemplateType;
        return {
          html: createBuyTemplate(data),
          name: `${customer.identityDocuments[0].number}-${transaction.creationDate}`,
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
        } as createSellTemplateType;

        return {
          html: createSellTemplate(data),
          name: `${customer.identityDocuments[0].number}-${transaction.creationDate}`,
        };
      }
      break;
    }
    case CustomerType.BUSINESS: {
      if (transaction.type === TransactionType.BUY) {
        console.log(JSON.stringify(transaction));
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
        } as createBuyTemplateType;

        return {
          html: createBuyTemplate(data),
          name: `${customer.identityDocuments[0].number}-${transaction.creationDate}`,
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
        } as createSellTemplateType;
        return {
          html: createSellTemplate(data),
          name: `${customer.identityDocuments[0].number}-${transaction.creationDate}`,
        };
      }
      break;
    }
    default: {
      throw new Error("Customer type not found");
    }
  }
};

// Generar imagen con getData y takeScreenshot
const generateImage = async (transactionId: string) => {
  const data = await getData(transactionId);
  await takeScreenshot(data.name, data.html);
};

const main = async ({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) => {
  const transactions = await getTransactionByStartAndEndDate({
    startDate,
    endDate,
  });

  transactions.map((t) => {
    generateImage(t.id);
  });
};

main({
  startDate: "2024-07-01",
  endDate: "2024-07-31",
});

/// email customer
/// email blum
/// fecha envío correo

/// Generar un excel
/// customerid transactionid nombre dni archivo
