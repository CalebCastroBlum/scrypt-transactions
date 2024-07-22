import puppeteer from "puppeteer";
import {
  getTransactionFromDynamoDb,
  getCustomer,
  getFundFromDynamoDb,
  getBankFromLambda,
} from "./repository";

import { getDateAsString, getHourAsString, currency } from "./util";

import {
  createBuyTemplate,
  type createBuyTemplateType,
  createSellTemplate,
  type createSellTemplateType,
  createPendingBuyTemplate,
  type createPendingBuyTemplateType,
  createPendingSellTemplate,
  type createPendingSellTemplateType,
} from "./templates";
import { Customer, CustomerType } from "./domain/Customer";
import { Fund } from "./domain/Fund";
import { TransactionType } from "./domain/Transaction";
import { Bank } from "./domain/Bank";

const takeScreenshot = async (transactionID: string, html: string) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  await page.screenshot({ path: `${transactionID}.png` });

  await browser.close();
};

const getData = async (transactionId: string) => {
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
          TRANSACTION_ID: transaction.origin.bank.transaction.id,
          BANK_NAME: new Bank(
            await getBankFromLambda(transaction.origin.bank.id)
          ).name,
        } as createBuyTemplateType;
        return createBuyTemplate(data);
      }

      if (transaction.type === TransactionType.SELL) {
        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: transaction.subType,
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          ACCOUNT: "-",
          SHARES: "-",
          SETTLEMENT_DATE: getDateAsString(transaction.settlementDate),
          BANK_NAME: new Bank(
            await getBankFromLambda(transaction.origin.bank.id)
          ).name,
        } as createSellTemplateType;

        return createSellTemplate(data);
      }
      break;
    }
    case CustomerType.BUSINESS: {
      if (transaction.type === TransactionType.BUY) {
        const data = {
          BUSINESS_NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
        } as createPendingBuyTemplateType;

        return "";
      }

      if (transaction.type === TransactionType.SELL) {
        const data = {
          BUSINESS_NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
        } as createPendingSellTemplateType;
        return "";
      }
      break;
    }
    default: {
      throw new Error("Customer type not found");
    }
  }
};

const generateImage = async (transactionId: string) => {
  const data = await getData(transactionId);
  await takeScreenshot(transactionId, data);
};

generateImage("003e2506-e4e1-48b5-85bc-3dc4fb030305");
