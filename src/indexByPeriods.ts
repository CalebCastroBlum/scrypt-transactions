import puppeteer from "puppeteer";
import {
  getTransactionFromDynamoDb,
  getTransactionDb,
  getCustomer,
  getFundFromDynamoDb,
  getBankFromLambda,
  getAccountFromLambda,
  getClientFromLambda,
  getTransactionByStartAndEndDate,
  makeCustomersCsv,
  makeCustomerPDF,
  getPivoltTransaction,
  getPivoltApiTransaction,
} from "./repository";

import { getDateAsString, getHourAsString, currency, fundsName } from "./util";

import {
  createBuyTemplate,
  type createBuyTemplateType,
  createSellTemplate,
  type createSellTemplateType,
} from "./templates";
import { Customer, CustomerType } from "./domain/Customer";
import { TransactionType } from "./domain/Transaction";
import { Bank } from "./domain/Bank";
import { Client } from "./domain/Client";
import { Account } from "./domain/Account";
import * as path from "path";
import * as fs from "fs";

const typeTransaction = {
  PARTIAL: "Parcial",
  TOTAL: "Total",
};

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
  transaction: any
): Promise<{
  html: string;
  archive: string;
  data: createBuyTemplateType | createSellTemplateType;
}> => {
  const customer = new Customer(await getCustomer(transaction.customerId));

  switch (customer.type) {
    case CustomerType.INDIVIDUAL: {
      if (transaction.type === TransactionType.BUY) {
        const data = {
          NAME: customer.name,
          FUND_NAME: fundsName[transaction.fund.id],
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency] || "$"} ${
            transaction.amount
          }`,
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
          STATUS: transaction.status,
        } as createBuyTemplateType;
        return {
          html: createBuyTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }

      if (transaction.type === TransactionType.SELL) {
        let account: Account;
        let isRescueByAmount: boolean = false;
        let isRescueByShares: boolean = false;
        let isRescueTotal: boolean = false;

        if (transaction.subType === "PARTIAL") {
          let pivolt = await getPivoltTransaction(transaction.transactionId);
          let pivoltData = await getPivoltApiTransaction(pivolt.pivoltId);
          switch (pivoltData.TransactionTypeDetail) {
            case "Redemption_Shares": {
              isRescueByShares = true;
              break;
            }
            case "Redemption_Full": {
              isRescueTotal = true;
              break;
            }
            case "Redemption_NetAmount": {
              isRescueByAmount = true;
              break;
            }
          }
        }

        if (!transaction.clientId) {
          account = await getAccountFromLambda(
            transaction.destiny.account.id,
            customer
          );
        }

        const data = {
          NAME: customer.name,
          FUND_NAME: fundsName[transaction.fund.id],
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: transaction.subType,
          AMOUNT: isRescueByAmount
            ? `${currency[transaction.currency]} ${transaction.amount}`
            : "-",
          ACCOUNT: transaction.clientId ? " - " : account.number,
          SHARES: isRescueByShares ? transaction.shares : "-",
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
          STATUS: transaction.status,
          isRescueByAmount,
          isRescueByShares,
          isRescueTotal,
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
          FUND_NAME: fundsName[transaction.fund.id],
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency] || "$"} ${
            transaction.amount
          }`,
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
          STATUS: transaction.status,
        } as createBuyTemplateType;

        return {
          html: createBuyTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }

      if (transaction.type === TransactionType.SELL) {
        let isRescueByAmount: boolean = false;
        let isRescueByShares: boolean = false;
        let isRescueTotal: boolean = false;
        if (transaction.subType === "PARTIAL") {
          let pivolt = await getPivoltTransaction(transaction.transactionId);
          let pivoltData = await getPivoltApiTransaction(pivolt.pivoltId);
          switch (pivoltData.TransactionTypeDetail) {
            case "Redemption_Shares": {
              isRescueByShares = true;
              break;
            }
            case "Redemption_Full": {
              isRescueTotal = true;
              break;
            }
            case "Redemption_NetAmount": {
              isRescueByAmount = true;
              break;
            }
          }
        }
        const account = await getAccountFromLambda(
          transaction.destiny.account.id,
          customer
        );

        console.log("SETTLEMENT_DATE", { date: transaction.settlementDate });

        const data = {
          NAME: customer.name,
          FUND_NAME: fundsName[transaction.fund.id],
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: typeTransaction[transaction.subType],
          AMOUNT: isRescueByAmount
            ? `${currency[transaction.currency]} ${transaction.amount}`
            : "-",
          ACCOUNT: account.number,
          SETTLEMENT_DATE: "Pendiente de aprobación",
          BANK_NAME: new Bank(await getBankFromLambda(account.bank.id)).name,
          SHARES: isRescueByShares ? transaction.shares : "-",
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
          STATUS: transaction.status,
          isRescueByAmount,
          isRescueByShares,
          isRescueTotal,
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
  const transactions = await getTransactionByStartAndEndDate({
    startDate,
    endDate,
  });

  console.log("OK", `total transactions: ${transactions.length}`);

  const transactionsWithData = await Promise.all(
    transactions.map(async (transaction) => {
      const { data, html, archive } = await getData(transaction);

      await takeScreenshot(archive, html);
      return {
        ...transaction,
        ...data,
        archive,
        html,
        emailBlum: "Blum <noreply@miblum.com>",
      };
    })
  );

  console.log("OK", `transactionsWithData`);

  // await makeCustomersCsv({
  //   transactions: transactionsWithData,
  //   path: "output.csv",
  // });

  await makeCustomerPDF({
    transactions: transactionsWithData,
    path: "outputByPeriods.pdf",
  });
  console.log("Done");
};

main({
  startDate: "2022-12-15T00:00:00",
  endDate: "2022-12-31T23:59:59",
});
